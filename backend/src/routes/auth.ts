import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { sendSuccess, sendError } from '../middleware/envelope';
import { loadStorage, saveUsers, saveRefreshTokens } from '../storage';

const router = Router();

// Persistent storage for development
interface UserData {
  id: string;
  mobileNumber: string;
  password: string;
  name?: string;
  preferredLang?: string;
  village?: string;
  district?: string;
  state?: string;
  landSizeAcres?: number;
}

// Load data from persistent storage
const storage = loadStorage();
const users = storage.users;
const usersById = storage.usersById;
const refreshTokens = storage.refreshTokens;

// Export users map so it can be accessed from app.ts
export { users, usersById };

/**
 * POST /api/v1/auth/register
 * Body: { mobileNumber: string, password: string }
 * Simple password-based registration for development
 */
router.post('/register', async (req: Request, res: Response) => {
  const { mobileNumber, password } = req.body as { mobileNumber?: string; password?: string };

  if (!mobileNumber || !password) {
    sendError(res, 400, 'VALIDATION_ERROR', 'mobileNumber and password are required');
    return;
  }

  const cleanMobile = mobileNumber.trim();

  try {
    // Check if user already exists
    if (users.has(cleanMobile)) {
      sendError(res, 400, 'USER_EXISTS', 'User with this mobile number already exists');
      return;
    }

    // Create new user
    const farmerId = uuidv4();
    const userData = { 
      id: farmerId, 
      mobileNumber: cleanMobile,
      password,
      name: '',
      preferredLang: 'en',
      village: '',
      district: '',
      state: '',
      landSizeAcres: 0
    };
    users.set(cleanMobile, userData);
    usersById.set(farmerId, userData);

    // Save to persistent storage
    saveUsers(users, usersById);

    // Try to sync with PostgreSQL if available
    try {
      const { query } = require('../db');
      await query(
        `INSERT INTO farmers (id, mobile_number, preferred_lang) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
        [farmerId, cleanMobile, 'en']
      );
    } catch (e) {
      // Database not available or table not migrated yet
    }

    // Issue JWT tokens
    const accessToken = jwt.sign({ sub: farmerId }, config.jwtSecret, { expiresIn: '1h' });
    const refreshToken = uuidv4();
    refreshTokens.set(farmerId, refreshToken);
    saveRefreshTokens(refreshTokens);

    sendSuccess(res, { accessToken, refreshToken, farmerId });
  } catch (err) {
    console.error('Registration error:', err);
    sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

/**
 * POST /api/v1/auth/login
 * Body: { mobileNumber: string, password: string }
 * Login with mobile and password
 */
router.post('/login', async (req: Request, res: Response) => {
  const { mobileNumber, password } = req.body as { mobileNumber?: string; password?: string };

  if (!mobileNumber || !password) {
    sendError(res, 400, 'VALIDATION_ERROR', 'mobileNumber and password are required');
    return;
  }

  const cleanMobile = mobileNumber.trim();

  try {
    // Find user in memory map
    let user = users.get(cleanMobile);

    // Fallback search across all users if cleanMobile key mismatch
    if (!user) {
      for (const u of users.values()) {
        if (u.mobileNumber && u.mobileNumber.trim() === cleanMobile) {
          user = u;
          users.set(cleanMobile, user);
          break;
        }
      }
    }

    // Fallback DB check if user not in memory
    if (!user) {
      try {
        const { query } = require('../db');
        const dbResult = await query(
          `SELECT * FROM farmers WHERE mobile_number = $1`,
          [cleanMobile]
        );
        if (dbResult.rows.length > 0) {
          const row = dbResult.rows[0];
          user = {
            id: row.id,
            mobileNumber: cleanMobile,
            password: row.password || password,
            name: row.name || '',
            preferredLang: row.preferred_lang || 'en',
            village: row.village || '',
            district: row.district || '',
            state: row.state || '',
            landSizeAcres: row.land_size_acres ? Number(row.land_size_acres) : 0,
          };
          users.set(cleanMobile, user);
          usersById.set(user.id, user);
          saveUsers(users, usersById);
        }
      } catch (e) {
        // Database not available
      }
    }
    
    if (!user || user.password !== password) {
      sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid mobile number or password');
      return;
    }

    // Issue JWT tokens
    const accessToken = jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: '1h' });
    const refreshToken = uuidv4();
    refreshTokens.set(user.id, refreshToken);
    saveRefreshTokens(refreshTokens);
    
    // Ensure both maps are populated
    users.set(cleanMobile, user);
    usersById.set(user.id, user);
    saveUsers(users, usersById);

    // Try to sync with PostgreSQL if available
    try {
      const { query } = require('../db');
      await query(
        `INSERT INTO farmers (id, mobile_number, preferred_lang) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
        [user.id, cleanMobile, user.preferredLang || 'en']
      );
    } catch (e) {
      // Database not available or table not migrated yet
    }

    sendSuccess(res, { accessToken, refreshToken, farmerId: user.id });
  } catch (err) {
    console.error('Login error:', err);
    sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

/**
 * POST /api/v1/auth/refresh
 * Body: { farmerId: string, refreshToken: string }
 * Validates the refresh token and issues a new access token.
 */
router.post('/refresh', async (req: Request, res: Response) => {
  const { farmerId, refreshToken } = req.body as { farmerId?: string; refreshToken?: string };

  if (!farmerId || !refreshToken) {
    sendError(res, 400, 'VALIDATION_ERROR', 'farmerId and refreshToken are required');
    return;
  }

  try {
    const stored = refreshTokens.get(farmerId);

    if (!stored || stored !== refreshToken) {
      sendError(res, 401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or has expired');
      return;
    }

    // Issue new access token
    const accessToken = jwt.sign({ sub: farmerId }, config.jwtSecret, { expiresIn: '1h' });

    // Rotate refresh token
    const newRefreshToken = uuidv4();
    refreshTokens.set(farmerId, newRefreshToken);
    saveRefreshTokens(refreshTokens);

    sendSuccess(res, { accessToken, refreshToken: newRefreshToken, farmerId });
  } catch (err) {
    sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

/**
 * POST /api/v1/auth/logout  (protected — expects req.farmerId set by auth middleware)
 * Deletes the refresh token.
 */
router.post('/logout', async (req: Request, res: Response) => {
  // farmerId is expected to be attached by the JWT auth middleware
  const farmerId = (req as Request & { farmerId?: string }).farmerId;

  if (!farmerId) {
    sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
    return;
  }

  try {
    refreshTokens.delete(farmerId);
    sendSuccess(res, { message: 'Logged out successfully' });
  } catch (err) {
    sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
});

export default router;
