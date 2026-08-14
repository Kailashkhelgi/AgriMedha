import express, { Request, Response, NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import rateLimit from 'express-rate-limit';
import swaggerSpec from './swagger';
import { authenticateJwt } from './middleware/auth';
import { sendError, sendSuccess } from './middleware/envelope';
import { AppError, getFarmerProfile, updateFarmerProfile } from './services/userService';

import authRouter from './routes/auth';
import soilProfilesRouter from './routes/soilProfiles';
import advisoryRouter from './routes/advisory';
import imagesRouter from './routes/images';
import weatherRouter from './routes/weather';
import marketPricesRouter from './routes/marketPrices';
import feedbackRouter from './routes/feedback';
import notificationsRouter from './routes/notifications';

export function createApp(): express.Application {
  const app = express();


  // ── 1. Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ── 2. CORS ──────────────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (_req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // ── 3. Rate limiting ─────────────────────────────────────────────────────────
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: 'error',
      data: null,
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later.' },
    },
  });
  app.use(limiter);

  // ── 4. Swagger UI ────────────────────────────────────────────────────────────
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // ── 5. Public auth routes (no JWT required) ──────────────────────────────────
  app.use('/api/v1/auth', authRouter);

  // ── Health check ─────────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    sendSuccess(res, { status: 'ok' });
  });

  // ── 6. JWT authentication for all routes below ───────────────────────────────
  app.use(authenticateJwt);

  // ── 7. Protected routers ─────────────────────────────────────────────────────
  app.use('/api/v1/soil-profiles', soilProfilesRouter);
  app.use('/api/v1/advisory', advisoryRouter);
  app.use('/api/v1/images', imagesRouter);
  app.use('/api/v1/weather', weatherRouter);
  app.use('/api/v1/market-prices', marketPricesRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  // feedbackRouter handles both /feedback and /dashboard/reports
  app.use('/api/v1', feedbackRouter);

  // ── Farmers profile routes (inline) - Resilient storage handling ───────────
  app.get('/api/v1/farmers/me', async (req: Request, res: Response) => {
    if (!req.farmerId) {
      sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      return;
    }
    try {
      // Try to get from database first
      try {
        const profile = await getFarmerProfile(req.farmerId);
        sendSuccess(res, profile);
      } catch (dbErr) {
        // Fall back to in-memory user data
        const authModule = require('./routes/auth');
        let user = authModule.usersById.get(req.farmerId);
        if (!user) {
          // If not in memory (e.g. server restarted), initialize default profile entry
          user = {
            id: req.farmerId,
            mobileNumber: '',
            password: '',
            name: '',
            preferredLang: 'en',
            village: '',
            district: '',
            state: '',
            landSizeAcres: 0
          };
          authModule.usersById.set(req.farmerId, user);
        }
        // Return profile from in-memory user data
        sendSuccess(res, {
          id: req.farmerId,
          mobileNumber: user.mobileNumber || '',
          name: user.name || '',
          preferredLang: user.preferredLang || 'en',
          village: user.village || '',
          district: user.district || '',
          state: user.state || '',
          landSizeAcres: user.landSizeAcres || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } catch (err) {
      sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
  });

  app.put('/api/v1/farmers/me', async (req: Request, res: Response) => {
    if (!req.farmerId) {
      sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
      return;
    }
    try {
      // Try database first, fall back to in-memory
      try {
        const updated = await updateFarmerProfile(req.farmerId, req.body);
        sendSuccess(res, updated);
      } catch (dbErr) {
        // Database not available - update in-memory user data
        const authModule = require('./routes/auth');
        const { saveUsers } = require('./storage');
        let user = authModule.usersById.get(req.farmerId);
        if (!user) {
          user = {
            id: req.farmerId,
            mobileNumber: '',
            password: '',
            name: '',
            preferredLang: 'en',
            village: '',
            district: '',
            state: '',
            landSizeAcres: 0
          };
          authModule.usersById.set(req.farmerId, user);
        }
        // Update in-memory user data
        if (req.body.name !== undefined) user.name = req.body.name;
        if (req.body.preferredLang !== undefined) user.preferredLang = req.body.preferredLang;
        if (req.body.village !== undefined) user.village = req.body.village;
        if (req.body.district !== undefined) user.district = req.body.district;
        if (req.body.state !== undefined) user.state = req.body.state;
        if (req.body.landSizeAcres !== undefined) user.landSizeAcres = req.body.landSizeAcres;
        
        // Save to persistent storage
        saveUsers(authModule.users, authModule.usersById);
        
        sendSuccess(res, {
          id: req.farmerId,
          mobileNumber: user.mobileNumber,
          name: user.name || '',
          preferredLang: user.preferredLang || 'en',
          village: user.village || '',
          district: user.district || '',
          state: user.state || '',
          landSizeAcres: user.landSizeAcres || 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } catch (err) {
      sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
  });

  // ── 8. Global error handler ──────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      sendError(res, 400, err.code, err.message, err.field);
    } else {
      console.error('[ERROR]', err);
      sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
  });

  return app;
}
