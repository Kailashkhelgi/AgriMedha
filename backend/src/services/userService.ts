import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { query } from '../db';
import { getRedisClient } from '../redis';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FarmerProfileData {
  mobileNumber: string;
  name?: string;
  preferredLang?: 'en' | 'hi' | 'pa';
  village?: string;
  district?: string;
  state?: string;
  landSizeAcres?: number;
}

export interface FarmerProfile {
  id: string;
  mobileNumber: string;
  name?: string;
  preferredLang: string;
  village?: string;
  district?: string;
  state?: string;
  landSizeAcres?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OtpProvider {
  send(mobileNumber: string, otp: string): Promise<void>;
}

// ─── App error ────────────────────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly field?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ─── Default OTP provider (real SMS) ─────────────────────────────────────────

export const defaultOtpProvider: OtpProvider = {
  async send(mobileNumber: string, otp: string): Promise<void> {
    // Real implementation would call Twilio / MSG91 here.
    // Kept as a no-op stub so the service compiles without a live key.
    void mobileNumber;
    void otp;
  },
};

// ─── Redis singleton ──────────────────────────────────────────────────────────

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = getRedisClient() as Redis;
  }
  return _redis;
}

// ─── UserService ──────────────────────────────────────────────────────────────

/**
 * Send a 6-digit OTP to the given mobile number.
 * Stores the OTP in Redis at `otp:{mobileNumber}` with a 10-minute TTL.
 */
export async function sendOtp(
  mobileNumber: string,
  otpProvider: OtpProvider = defaultOtpProvider,
  redis: Redis = getRedis()
): Promise<void> {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  await redis.set(`otp:${mobileNumber}`, otp, 'EX', 600);
  await otpProvider.send(mobileNumber, otp);
}

/**
 * Verify the OTP for a mobile number.
 * On success, deletes the OTP from Redis, looks up or creates the farmer record,
 * issues a signed JWT access token (1 h) and a refresh token (30 days).
 */
export async function verifyOtp(
  mobileNumber: string,
  otp: string,
  redis: Redis = getRedis()
): Promise<{ accessToken: string; refreshToken: string; farmerId: string }> {
  const stored = await redis.get(`otp:${mobileNumber}`);

  if (!stored || stored !== otp) {
    throw new AppError('INVALID_OTP', 'OTP is invalid or has expired');
  }

  // Delete OTP immediately after successful verification
  await redis.del(`otp:${mobileNumber}`);

  // Look up or create farmer record
  const existing = await query<{ id: string }>(
    'SELECT id FROM farmers WHERE mobile_number = $1',
    [mobileNumber]
  );

  let farmerId: string;

  if (existing.rows.length > 0) {
    farmerId = existing.rows[0].id;
  } else {
    const inserted = await query<{ id: string }>(
      `INSERT INTO farmers (mobile_number) VALUES ($1) RETURNING id`,
      [mobileNumber]
    );
    farmerId = inserted.rows[0].id;
  }

  // Issue JWT access token (1 h)
  const accessToken = jwt.sign({ sub: farmerId }, config.jwtSecret, {
    expiresIn: '1h',
  });

  // Generate refresh token and store in Redis with 30-day TTL
  const refreshToken = uuidv4();
  const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
  await redis.set(`refresh:${farmerId}`, refreshToken, 'EX', thirtyDaysInSeconds);

  return { accessToken, refreshToken, farmerId };
}

/**
 * Create a new farmer profile.
 * Throws DUPLICATE_MOBILE if the mobile number is already registered.
 */
export async function createFarmerProfile(
  farmerId: string,
  profileData: FarmerProfileData
): Promise<FarmerProfile> {
  try {
    const result = await query<{
      id: string;
      mobile_number: string;
      name: string | null;
      preferred_lang: string;
      village: string | null;
      district: string | null;
      state: string | null;
      land_size_acres: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO farmers
         (id, mobile_number, name, preferred_lang, village, district, state, land_size_acres)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        farmerId,
        profileData.mobileNumber,
        profileData.name ?? null,
        profileData.preferredLang ?? 'en',
        profileData.village ?? null,
        profileData.district ?? null,
        profileData.state ?? null,
        profileData.landSizeAcres ?? null,
      ]
    );

    return rowToProfile(result.rows[0]);
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) {
      throw new AppError('DUPLICATE_MOBILE', 'Mobile number is already registered');
    }
    throw err;
  }
}

/**
 * Retrieve an existing farmer profile by ID.
 */
export async function getFarmerProfile(farmerId: string): Promise<FarmerProfile> {
  const result = await query<{
    id: string;
    mobile_number: string;
    name: string | null;
    preferred_lang: string;
    village: string | null;
    district: string | null;
    state: string | null;
    land_size_acres: string | null;
    created_at: Date;
    updated_at: Date;
  }>('SELECT * FROM farmers WHERE id = $1', [farmerId]);

  if (result.rows.length === 0) {
    throw new AppError('NOT_FOUND', 'Farmer not found');
  }

  return rowToProfile(result.rows[0]);
}

/**
 * Update an existing farmer profile.
 * Returns the updated profile.
 */
export async function updateFarmerProfile(
  farmerId: string,
  updates: Partial<FarmerProfileData>
): Promise<FarmerProfile> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (updates.mobileNumber !== undefined) {
    setClauses.push(`mobile_number = $${idx++}`);
    values.push(updates.mobileNumber);
  }
  if (updates.name !== undefined) {
    setClauses.push(`name = $${idx++}`);
    values.push(updates.name);
  }
  if (updates.preferredLang !== undefined) {
    setClauses.push(`preferred_lang = $${idx++}`);
    values.push(updates.preferredLang);
  }
  if (updates.village !== undefined) {
    setClauses.push(`village = $${idx++}`);
    values.push(updates.village);
  }
  if (updates.district !== undefined) {
    setClauses.push(`district = $${idx++}`);
    values.push(updates.district);
  }
  if (updates.state !== undefined) {
    setClauses.push(`state = $${idx++}`);
    values.push(updates.state);
  }
  if (updates.landSizeAcres !== undefined) {
    setClauses.push(`land_size_acres = $${idx++}`);
    values.push(updates.landSizeAcres);
  }

  // Always bump updated_at
  setClauses.push(`updated_at = now()`);

  if (setClauses.length > 1) {
    values.push(farmerId);
    const result = await query<{
      id: string;
      mobile_number: string;
      name: string | null;
      preferred_lang: string;
      village: string | null;
      district: string | null;
      state: string | null;
      land_size_acres: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE farmers SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length > 0) {
      return rowToProfile(result.rows[0]);
    }
  }

  // If row was not updated (didn't exist yet in DB), insert/upsert a new row for this farmerId
  const mobile = updates.mobileNumber || `user_${farmerId.slice(0, 8)}`;
  const insertResult = await query<{
    id: string;
    mobile_number: string;
    name: string | null;
    preferred_lang: string;
    village: string | null;
    district: string | null;
    state: string | null;
    land_size_acres: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `INSERT INTO farmers (id, mobile_number, name, preferred_lang, village, district, state, land_size_acres)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       preferred_lang = EXCLUDED.preferred_lang,
       village = EXCLUDED.village,
       district = EXCLUDED.district,
       state = EXCLUDED.state,
       land_size_acres = EXCLUDED.land_size_acres,
       updated_at = now()
     RETURNING *`,
    [
      farmerId,
      mobile,
      updates.name ?? null,
      updates.preferredLang ?? 'en',
      updates.village ?? null,
      updates.district ?? null,
      updates.state ?? null,
      updates.landSizeAcres ?? null,
    ]
  );

  return rowToProfile(insertResult.rows[0]);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToProfile(row: {
  id: string;
  mobile_number: string;
  name: string | null;
  preferred_lang: string;
  village: string | null;
  district: string | null;
  state: string | null;
  land_size_acres: string | null;
  created_at: Date;
  updated_at: Date;
}): FarmerProfile {
  return {
    id: row.id,
    mobileNumber: row.mobile_number,
    name: row.name ?? undefined,
    preferredLang: row.preferred_lang,
    village: row.village ?? undefined,
    district: row.district ?? undefined,
    state: row.state ?? undefined,
    landSizeAcres: row.land_size_acres != null ? parseFloat(row.land_size_acres) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === '23505'
  );
}
