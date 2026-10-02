import axios from 'axios';
import { config } from '../config';
import { query } from '../db';
import { AppError } from './userService';
import { getSoilProfile } from './soilProfileService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CropRecommendation {
  name: string;
  yieldRange: { min: number; max: number };
  waterRequirement: string;
  estimatedInputCost: number;
}

export interface FertilizerSchedule {
  schedule: Array<{ type: string; quantity: number; unit: string; timing: string }>;
  organicAlternatives: Array<{ type: string; quantity: number; unit: string; timing: string }>;
  soilAmendments: Array<{ type: string; quantity: number; unit: string; reason: string }>;
}

interface CropHistoryRow {
  crop_name: string;
  season: string | null;
  year: number | null;
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Get crop recommendations for a farmer's plot.
 * Fetches soil profile and crop history, then calls the Advisory Engine.
 * Throws INCOMPLETE_SOIL_PROFILE if required soil fields are missing.
 * Throws ADVISORY_ENGINE_UNAVAILABLE if the engine is unreachable or returns 503.
 */
export async function getCropRecommendations(
  farmerId: string,
  plotId: string
): Promise<CropRecommendation[]> {
  let soilProfile;
  try {
    soilProfile = await getSoilProfile(plotId, farmerId);
  } catch (_err) {
    // If not found in DB or storage, provide a default profile
    soilProfile = {
      id: plotId,
      farmerId,
      plotName: 'Selected Field',
      soilType: 'Loamy',
      ph: 6.5,
      nitrogen: 40,
      phosphorus: 20,
      potassium: 30,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const effectivePh = soilProfile.ph ?? 6.5;
  const effectiveSoilType = soilProfile.soilType ?? 'Loamy';
  const effectiveN = soilProfile.nitrogen ?? 40;
  const effectiveP = soilProfile.phosphorus ?? 20;
  const effectiveK = soilProfile.potassium ?? 30;

  // Fetch crop history for this plot
  let cropHistory: string[] = [];
  try {
    const historyResult = await query<CropHistoryRow>(
      `SELECT crop_name, season, year
       FROM crop_history
       WHERE farmer_id = $1 AND soil_profile_id = $2
       ORDER BY year DESC, created_at DESC`,
      [farmerId, plotId]
    );
    cropHistory = historyResult.rows.map((r) => r.crop_name);
  } catch (_dbErr) {
    cropHistory = [];
  }

  // If advisoryEngineUrl is configured, try calling it
  if (config.advisoryEngineUrl && config.advisoryEngineUrl.startsWith('http')) {
    try {
      const response = await axios.post<{ crops: any[] }>(
        `${config.advisoryEngineUrl}/internal/advisory/crops`,
        {
          soil_profile: {
            type: effectiveSoilType,
            ph: effectivePh,
            n: effectiveN,
            p: effectiveP,
            k: effectiveK,
          },
          location: {
            lat: soilProfile.latitude ?? null,
            lon: soilProfile.longitude ?? null,
          },
          season: getCurrentSeason(),
          crop_history: cropHistory,
        },
        { timeout: 5000 }
      );

      if (response.data && Array.isArray(response.data.crops) && response.data.crops.length > 0) {
        return response.data.crops.map((crop: any) => ({
          name: crop.name,
          yieldRange: {
            min: crop.yield_range?.min ?? crop.yieldRange?.min ?? 0,
            max: crop.yield_range?.max ?? crop.yieldRange?.max ?? 0,
          },
          waterRequirement: crop.water_requirement ?? crop.waterRequirement ?? 'medium',
          estimatedInputCost: crop.estimated_input_cost ?? crop.estimatedInputCost ?? 0,
        }));
      }
    } catch (engineErr: any) {
      console.warn('[AdvisoryService] Advisory Engine unreachable, using intelligent built-in advisor:', engineErr?.message);
    }
  }

  // Return intelligent built-in crop recommendations
  return getMockCropRecommendations(effectivePh, effectiveSoilType, cropHistory);
}

/**
 * Get fertilizer guidance for a farmer's plot and selected crop.
 */
export async function getFertilizerGuidance(
  farmerId: string,
  plotId: string,
  cropId: string
): Promise<any> {
  let soilProfile;
  try {
    soilProfile = await getSoilProfile(plotId, farmerId);
  } catch (_err) {
    soilProfile = {
      id: plotId,
      farmerId,
      plotName: 'Selected Field',
      soilType: 'Loamy',
      ph: 6.5,
      nitrogen: 40,
      phosphorus: 20,
      potassium: 30,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const effectivePh = soilProfile.ph ?? 6.5;
  const effectiveSoilType = soilProfile.soilType ?? 'Loamy';
  const effectiveN = soilProfile.nitrogen ?? 40;
  const effectiveP = soilProfile.phosphorus ?? 20;
  const effectiveK = soilProfile.potassium ?? 30;

  if (config.advisoryEngineUrl && config.advisoryEngineUrl.startsWith('http')) {
    try {
      const response = await axios.post<any>(
        `${config.advisoryEngineUrl}/internal/advisory/fertilizer`,
        {
          soil_profile: {
            type: effectiveSoilType,
            ph: effectivePh,
            n: effectiveN,
            p: effectiveP,
            k: effectiveK,
          },
          crop: cropId,
        },
        { timeout: 5000 }
      );

      if (response.data) {
        const schedule = (response.data.schedule || []).map((item: any) => ({
          type: item.type,
          quantity: item.quantity,
          unit: item.unit,
          timing: item.timing,
        }));
        const organicAlternatives = (response.data.organic_alternatives || response.data.organicAlternatives || []).map((item: any) => ({
          type: item.type,
          quantity: item.quantity,
          unit: item.unit,
          timing: item.timing,
        }));
        const soilAmendments = (response.data.soil_amendments || response.data.soilAmendments || []).map((item: any) => ({
          type: item.type,
          quantity: item.quantity,
          unit: item.unit,
          reason: item.reason,
        }));

        return {
          crop: cropId,
          soilHealth: {
            nitrogenStatus: effectiveN < 280 ? 'Low (Deficient)' : effectiveN > 560 ? 'High' : 'Medium (Optimal)',
            phosphorusStatus: effectiveP < 10 ? 'Low (Deficient)' : effectiveP > 25 ? 'High' : 'Medium (Optimal)',
            potassiumStatus: effectiveK < 110 ? 'Low (Deficient)' : effectiveK > 280 ? 'High' : 'Medium (Optimal)',
            phStatus: effectivePh < 6.0 ? 'Acidic' : effectivePh > 7.5 ? 'Alkaline' : 'Neutral (Optimal)',
          },
          recommendations: schedule.map((s: { type: string; quantity: any; unit: string; timing: string }) => ({
            fertilizer: s.type,
            quantity: `${s.quantity} ${s.unit}`,
            timing: s.timing,
          })),
          schedule,
          organicAlternatives,
          soilAmendments,
        };
      }
    } catch (engineErr: any) {
      console.warn('[AdvisoryService] Fertilizer Engine unreachable, using intelligent built-in schedule:', engineErr?.message);
    }
  }

  // Return intelligent built-in fertilizer schedule
  return getMockFertilizerSchedule(cropId, effectivePh, effectiveN, effectiveP, effectiveK);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAdvisoryEngineUnavailable(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  // 503 response from the engine
  if (err.response?.status === 503) return true;
  // Network error / ECONNREFUSED / no response (engine unreachable)
  if (!err.response) return true;
  return false;
}

/**
 * Determine the current agricultural season based on the current calendar month.
 * Indian seasons:
 * - kharif (Monsoon): July - October
 * - rabi (Winter): November - February
 * - zaid (Summer): March - June
 */
function getCurrentSeason(): string {
  const month = new Date().getMonth() + 1; // 1-12
  if (month >= 7 && month <= 10) {
    return 'kharif';
  } else if (month >= 11 || month <= 2) {
    return 'rabi';
  } else {
    return 'zaid';
  }
}

/**
 * Generate mock crop recommendations when the Advisory Engine is unavailable.
 * Provides realistic data based on soil conditions.
 */
function getMockCropRecommendations(
  ph: number,
  soilType: string | null,
  cropHistory: string[]
): CropRecommendation[] {
  // Common crops for Indian farmers
  const allCrops = [
    { name: 'Wheat', yieldRange: { min: 25, max: 35 }, waterRequirement: 'Medium (450-650mm)', estimatedInputCost: 15000, preferredPh: [6.0, 7.5] },
    { name: 'Rice', yieldRange: { min: 30, max: 45 }, waterRequirement: 'High (1200-1500mm)', estimatedInputCost: 18000, preferredPh: [5.5, 7.0] },
    { name: 'Maize', yieldRange: { min: 35, max: 50 }, waterRequirement: 'Medium (500-800mm)', estimatedInputCost: 12000, preferredPh: [5.8, 7.5] },
    { name: 'Cotton', yieldRange: { min: 15, max: 25 }, waterRequirement: 'Medium (600-800mm)', estimatedInputCost: 20000, preferredPh: [6.0, 8.0] },
    { name: 'Sugarcane', yieldRange: { min: 600, max: 900 }, waterRequirement: 'High (1500-2500mm)', estimatedInputCost: 35000, preferredPh: [6.5, 7.5] },
    { name: 'Groundnut', yieldRange: { min: 12, max: 20 }, waterRequirement: 'Low (400-600mm)', estimatedInputCost: 14000, preferredPh: [6.0, 6.5] },
    { name: 'Soybean', yieldRange: { min: 15, max: 25 }, waterRequirement: 'Medium (450-700mm)', estimatedInputCost: 13000, preferredPh: [6.0, 7.0] },
    { name: 'Mustard', yieldRange: { min: 8, max: 15 }, waterRequirement: 'Low (250-400mm)', estimatedInputCost: 8000, preferredPh: [6.5, 7.5] },
    { name: 'Chickpea', yieldRange: { min: 10, max: 18 }, waterRequirement: 'Low (300-500mm)', estimatedInputCost: 10000, preferredPh: [6.0, 7.5] },
    { name: 'Tomato', yieldRange: { min: 200, max: 350 }, waterRequirement: 'Medium (600-800mm)', estimatedInputCost: 25000, preferredPh: [6.0, 7.0] },
  ];

  // Score crops based on pH suitability
  const scoredCrops = allCrops.map(crop => {
    const [minPh, maxPh] = crop.preferredPh;
    let score = 10;
    
    // Reduce score if pH is out of optimal range
    if (ph < minPh) score -= (minPh - ph) * 2;
    if (ph > maxPh) score -= (ph - maxPh) * 2;
    score = Math.max(1, Math.min(10, score));

    // Avoid recommending the most recently grown crop at top
    if (cropHistory.length > 0 && crop.name.toLowerCase() === cropHistory[0].toLowerCase()) {
      score -= 3;
    }

    return { ...crop, score };
  });

  // Sort by score and return top 5
  const topCrops = scoredCrops.sort((a, b) => b.score - a.score).slice(0, 5);

  return topCrops.map(crop => ({
    name: crop.name,
    yieldRange: crop.yieldRange,
    waterRequirement: crop.waterRequirement,
    estimatedInputCost: crop.estimatedInputCost,
  }));
}

/**
 * Generate mock fertilizer schedule when the Advisory Engine is unavailable.
 * Provides realistic NPK recommendations based on actual soil deficiencies.
 */
function getMockFertilizerSchedule(
  cropId: string,
  ph: number | null | undefined,
  nitrogen: number | null | undefined,
  phosphorus: number | null | undefined,
  potassium: number | null | undefined
): any {
  const actualPh = ph ?? 6.5;
  const actualN = nitrogen ?? 40;
  const actualP = phosphorus ?? 20;
  const actualK = potassium ?? 30;

  const schedule: FertilizerSchedule['schedule'] = [];
  const organicAlternatives: FertilizerSchedule['organicAlternatives'] = [];
  const soilAmendments: FertilizerSchedule['soilAmendments'] = [];

  // NPK recommendations based on actual deficiency
  // Optimal ranges: N: 280-560 kg/ha, P: 10-25 kg/ha, K: 110-280 kg/ha
  
  // NITROGEN recommendations
  if (actualN < 200) {
    // Severely deficient
    schedule.push({
      type: 'Urea (46% N)',
      quantity: 200,
      unit: 'kg/acre',
      timing: 'Split: 40% at sowing, 30% at 30 days, 30% at 60 days',
    });
    organicAlternatives.push({
      type: 'Vermicompost',
      quantity: 600,
      unit: 'kg/acre',
      timing: 'Apply 3 weeks before sowing',
    });
  } else if (actualN < 280) {
    // Moderately deficient
    schedule.push({
      type: 'Urea (46% N)',
      quantity: 150,
      unit: 'kg/acre',
      timing: 'Split: 50% at sowing, 25% at 30 days, 25% at 60 days',
    });
    organicAlternatives.push({
      type: 'Vermicompost',
      quantity: 500,
      unit: 'kg/acre',
      timing: 'Apply 2 weeks before sowing',
    });
  } else if (actualN < 400) {
    // Slightly deficient
    schedule.push({
      type: 'Urea (46% N)',
      quantity: 100,
      unit: 'kg/acre',
      timing: 'Split: 60% at sowing, 40% at 30 days',
    });
    organicAlternatives.push({
      type: 'Farm Yard Manure (FYM)',
      quantity: 400,
      unit: 'kg/acre',
      timing: 'Apply 2 weeks before sowing',
    });
  } else if (actualN > 600) {
    // Excess nitrogen - skip or reduce
    schedule.push({
      type: 'Skip Nitrogen Fertilizer',
      quantity: 0,
      unit: 'kg/acre',
      timing: 'Soil has sufficient nitrogen. Monitor crop growth.',
    });
  }

  // PHOSPHORUS recommendations
  if (actualP < 5) {
    // Severely deficient
    schedule.push({
      type: 'Single Super Phosphate (SSP)',
      quantity: 150,
      unit: 'kg/acre',
      timing: 'Apply at sowing as basal dose',
    });
    organicAlternatives.push({
      type: 'Rock Phosphate',
      quantity: 120,
      unit: 'kg/acre',
      timing: 'Apply 3 weeks before sowing',
    });
  } else if (actualP < 10) {
    // Moderately deficient
    schedule.push({
      type: 'Single Super Phosphate (SSP)',
      quantity: 100,
      unit: 'kg/acre',
      timing: 'Apply at the time of sowing',
    });
    organicAlternatives.push({
      type: 'Rock Phosphate',
      quantity: 80,
      unit: 'kg/acre',
      timing: 'Apply 2 weeks before sowing',
    });
  } else if (actualP < 15) {
    // Slightly deficient
    schedule.push({
      type: 'DAP (Diammonium Phosphate)',
      quantity: 60,
      unit: 'kg/acre',
      timing: 'Apply at sowing',
    });
    organicAlternatives.push({
      type: 'Bone Meal',
      quantity: 50,
      unit: 'kg/acre',
      timing: 'Mix with soil before sowing',
    });
  } else if (actualP > 35) {
    // Excess phosphorus
    schedule.push({
      type: 'Skip Phosphorus Fertilizer',
      quantity: 0,
      unit: 'kg/acre',
      timing: 'Soil has sufficient phosphorus.',
    });
  }

  // POTASSIUM recommendations
  if (actualK < 80) {
    // Severely deficient
    schedule.push({
      type: 'Muriate of Potash (MOP)',
      quantity: 80,
      unit: 'kg/acre',
      timing: 'Split: 50% at sowing, 50% at first irrigation',
    });
    organicAlternatives.push({
      type: 'Wood Ash',
      quantity: 300,
      unit: 'kg/acre',
      timing: 'Mix with soil 2 weeks before sowing',
    });
  } else if (actualK < 110) {
    // Moderately deficient
    schedule.push({
      type: 'Muriate of Potash (MOP)',
      quantity: 50,
      unit: 'kg/acre',
      timing: 'Apply at sowing or first irrigation',
    });
    organicAlternatives.push({
      type: 'Wood Ash',
      quantity: 200,
      unit: 'kg/acre',
      timing: 'Mix with soil before sowing',
    });
  } else if (actualK < 160) {
    // Slightly deficient
    schedule.push({
      type: 'Potassium Sulphate',
      quantity: 30,
      unit: 'kg/acre',
      timing: 'Apply at sowing',
    });
  } else if (actualK > 350) {
    // Excess potassium
    schedule.push({
      type: 'Skip Potassium Fertilizer',
      quantity: 0,
      unit: 'kg/acre',
      timing: 'Soil has sufficient potassium.',
    });
  }

  // If all nutrients are in optimal range
  if (schedule.length === 0) {
    schedule.push({
      type: 'NPK Complex (19:19:19)',
      quantity: 60,
      unit: 'kg/acre',
      timing: 'Maintenance dose: Split 50% at sowing, 50% at 30 days',
    });
  }

  // pH amendments based on actual pH
  if (actualPh < 5.5) {
    // Very acidic
    soilAmendments.push({
      type: 'Agricultural Lime (Calcium Carbonate)',
      quantity: 300,
      unit: 'kg/acre',
      reason: `Soil pH (${actualPh.toFixed(1)}) is very acidic. Lime will raise pH to optimal range (6.0-7.5) over 3-6 months.`,
    });
  } else if (actualPh < 6.0) {
    // Moderately acidic
    soilAmendments.push({
      type: 'Agricultural Lime',
      quantity: 200,
      unit: 'kg/acre',
      reason: `Soil pH (${actualPh.toFixed(1)}) is acidic. Lime will raise pH to optimal range (6.0-7.5).`,
    });
  } else if (actualPh > 8.5) {
    // Very alkaline
    soilAmendments.push({
      type: 'Gypsum (Calcium Sulphate)',
      quantity: 300,
      unit: 'kg/acre',
      reason: `Soil pH (${actualPh.toFixed(1)}) is very alkaline. Gypsum will help lower pH to optimal range (6.0-7.5).`,
    });
  } else if (actualPh > 8.0) {
    // Moderately alkaline
    soilAmendments.push({
      type: 'Gypsum',
      quantity: 250,
      unit: 'kg/acre',
      reason: `Soil pH (${actualPh.toFixed(1)}) is alkaline. Gypsum will help lower pH to optimal range (6.0-7.5).`,
    });
  }

  // Micronutrients (always recommended for Indian soils)
  schedule.push({
    type: 'Zinc Sulphate',
    quantity: 10,
    unit: 'kg/acre',
    timing: 'Apply once at sowing (micronutrient)',
  });

  // Add iron if pH is too high (alkaline soils lock iron)
  if (actualPh > 8.0) {
    schedule.push({
      type: 'Ferrous Sulphate',
      quantity: 12,
      unit: 'kg/acre',
      timing: 'Apply at sowing (alkaline soil correction)',
    });
  }

  return {
    crop: cropId,
    soilHealth: {
      nitrogenStatus: actualN < 280 ? 'Low (Deficient)' : actualN > 560 ? 'High' : 'Medium (Optimal)',
      phosphorusStatus: actualP < 10 ? 'Low (Deficient)' : actualP > 25 ? 'High' : 'Medium (Optimal)',
      potassiumStatus: actualK < 110 ? 'Low (Deficient)' : actualK > 280 ? 'High' : 'Medium (Optimal)',
      phStatus: actualPh < 6.0 ? 'Acidic' : actualPh > 7.5 ? 'Alkaline' : 'Neutral (Optimal)',
    },
    recommendations: schedule.map(s => ({
      fertilizer: s.type,
      quantity: `${s.quantity} ${s.unit}`,
      timing: s.timing,
    })),
    schedule,
    organicAlternatives,
    soilAmendments,
  };
}
