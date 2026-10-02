import { Router, Request, Response } from 'express';
import { config } from '../config';
import { sendSuccess, sendError } from '../middleware/envelope';
import { AppError } from '../services/userService';
import { getCropRecommendations, getFertilizerGuidance } from '../services/advisoryService';

const router = Router();

/**
 * GET /api/v1/advisory/crops
 * Returns crop recommendations for the authenticated farmer's plot.
 * Query params: plotId (required)
 */
router.get('/crops', async (req: Request, res: Response) => {
  const farmerId = req.farmerId;
  if (!farmerId) {
    sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
    return;
  }

  const { plotId } = req.query;
  if (!plotId || typeof plotId !== 'string') {
    sendError(res, 400, 'MISSING_PARAM', 'plotId query parameter is required');
    return;
  }

  try {
    const recommendations = await getCropRecommendations(farmerId, plotId);
    sendSuccess(res, recommendations);
  } catch (err) {
    if (err instanceof AppError) {
      if (err.code === 'INCOMPLETE_SOIL_PROFILE') {
        sendError(res, 400, err.code, err.message);
      } else if (err.code === 'ADVISORY_ENGINE_UNAVAILABLE') {
        sendError(res, 503, err.code, err.message);
      } else if (err.code === 'NOT_FOUND') {
        sendError(res, 404, err.code, err.message);
      } else {
        sendError(res, 500, err.code, err.message);
      }
    } else {
      sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
  }
});

/**
 * GET /api/v1/advisory/fertilizer
 * Returns fertilizer guidance for the authenticated farmer's plot and crop.
 * Query params: plotId (required), cropId (required)
 */
router.get('/fertilizer', async (req: Request, res: Response) => {
  const farmerId = req.farmerId;
  if (!farmerId) {
    sendError(res, 401, 'UNAUTHORIZED', 'Authentication required');
    return;
  }

  const { plotId, cropId } = req.query;
  if (!plotId || typeof plotId !== 'string') {
    sendError(res, 400, 'MISSING_PARAM', 'plotId query parameter is required');
    return;
  }
  if (!cropId || typeof cropId !== 'string') {
    sendError(res, 400, 'MISSING_PARAM', 'cropId query parameter is required');
    return;
  }

  try {
    const schedule = await getFertilizerGuidance(farmerId, plotId, cropId);
    sendSuccess(res, schedule);
  } catch (err) {
    if (err instanceof AppError) {
      if (err.code === 'NO_SOIL_PROFILE') {
        sendError(res, 400, err.code, err.message);
      } else if (err.code === 'ADVISORY_ENGINE_UNAVAILABLE') {
        sendError(res, 503, err.code, err.message);
      } else if (err.code === 'NOT_FOUND') {
        sendError(res, 404, err.code, err.message);
      } else {
        sendError(res, 500, err.code, err.message);
      }
    } else {
      sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    }
  }
});

const SYSTEM_PROMPT = `You are AgriMedha AI, an expert agricultural assistant for Indian farmers. 
You help with:
- Crop selection based on soil type, pH, NPK values, season, and location
- Fertilizer recommendations and application schedules
- Pest and disease identification and treatment
- Irrigation advice and water management
- Weather impact on farming decisions
- Market price trends and selling strategies
- Organic farming practices
- Government schemes and MSP information
- Soil health improvement techniques

Always give practical, actionable advice. Keep responses concise and farmer-friendly.
Support queries in English, Hindi, Kannada, Punjabi, Telugu, and Marathi.
When answering, use simple language that a farmer can understand.`;

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

/**
 * POST /api/v1/advisory/chat
 * Secure AI Chatbot query proxied through the backend.
 */
router.post('/chat', async (req: Request, res: Response) => {
  const { message, history = [] } = req.body as {
    message?: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  if (!message || typeof message !== 'string' || !message.trim()) {
    sendError(res, 400, 'VALIDATION_ERROR', 'message is required');
    return;
  }

  const apiKey = config.geminiApiKey || process.env['GEMINI_API_KEY'] || process.env['VITE_GEMINI_API_KEY'];

  if (apiKey && apiKey !== 'your_gemini_api_key') {
    try {
      const axios = require('axios');
      const response = await axios.post(
        `${GEMINI_API_URL}?key=${apiKey}`,
        {
          contents: [
            {
              role: 'user',
              parts: [{ text: SYSTEM_PROMPT }],
            },
            ...history.map((m) => ({
              role: m.role === 'user' ? 'user' : 'model',
              parts: [{ text: m.content }],
            })),
            { role: 'user', parts: [{ text: message.trim() }] },
          ],
          generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
        },
        { timeout: 15000 }
      );

      const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) {
        sendSuccess(res, { reply });
        return;
      }
    } catch (err: any) {
      console.warn('[Advisory Chat] Gemini API error, falling back to local advisory:', err.message);
    }
  }

  // Fallback intelligent response for common farmer queries if API key is not active
  const lower = message.toLowerCase();
  let fallbackReply = "Namaste! For your farming query, ensure proper soil moisture, balanced NPK application based on soil testing, and timely pest monitoring. Feel free to ask specific questions about your crop type or symptoms!";

  if (lower.includes('black soil') || lower.includes('black cotton')) {
    fallbackReply = "Black soil (Regur) is rich in clay, calcium carbonate, potash, and magnesium with high moisture retention. Best crops: Cotton, Soybean, Wheat, Jowar, Linseed, Sunflower, and Gram.";
  } else if (lower.includes('yellow') && (lower.includes('leaf') || lower.includes('leaves') || lower.includes('tomato'))) {
    fallbackReply = "Yellowing leaves (chlorosis) in tomato commonly indicates: 1) Nitrogen deficiency (older bottom leaves turn yellow first) - apply Urea/vermicompost; 2) Overwatering or poor drainage; 3) Early Blight - spray Mancozeb (2g/L) or Neem oil.";
  } else if (lower.includes('urea') && lower.includes('wheat')) {
    fallbackReply = "Standard Urea dose for wheat: 100-120 kg/acre total. Apply in 3 splits: 50% as basal dose at sowing, 25% at first irrigation (CRI stage, 21 days), and 25% at tillering/second irrigation (40-45 days).";
  } else if (lower.includes('soil health') || lower.includes('improve soil')) {
    fallbackReply = "To improve soil health: 1) Apply well-rotted Farmyard Manure (FYM) or vermicompost (2-3 tons/acre); 2) Practice crop rotation with leguminous crops (pulses) to fix atmospheric nitrogen; 3) Avoid excessive chemical fertilizers and test soil pH annually.";
  }

  sendSuccess(res, { reply: fallbackReply });
});

export default router;
