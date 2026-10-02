const REQUIRED_ENV_VARS = [
  'PORT',
  'JWT_SECRET',
] as const;

const OPTIONAL_ENV_VARS = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_EXPIRES_IN',
  'REFRESH_TOKEN_EXPIRES_IN',
  'OTP_PROVIDER_API_KEY',
  'OTP_PROVIDER_SENDER_ID',
  'OPENWEATHERMAP_API_KEY',
  'MARKET_PRICE_API_KEY',
  'MARKET_PRICE_API_URL',
  'GOOGLE_CLOUD_API_KEY',
  'FCM_SERVER_KEY',
  'ADVISORY_ENGINE_URL',
  'VISION_ENGINE_URL',
  'GEMINI_API_KEY',
] as const;

for (const name of REQUIRED_ENV_VARS) {
  if (!process.env[name]) {
    console.error(`[FATAL] Missing required environment variable: ${name}`);
    process.exit(1);
  }
}

for (const name of OPTIONAL_ENV_VARS) {
  if (!process.env[name]) {
    console.warn(`[WARNING] Missing optional environment variable: ${name}`);
  }
}

export const config = {
  port: parseInt((process.env['PORT'] || '3000') as string, 10),
  databaseUrl: process.env['DATABASE_URL'] || '',
  redisUrl: process.env['REDIS_URL'] || '',
  jwtSecret: process.env['JWT_SECRET'] as string,
  jwtExpiresIn: process.env['JWT_EXPIRES_IN'] || '1h',
  refreshTokenExpiresIn: process.env['REFRESH_TOKEN_EXPIRES_IN'] || '30d',
  otpProviderApiKey: process.env['OTP_PROVIDER_API_KEY'] || '',
  otpProviderSenderId: process.env['OTP_PROVIDER_SENDER_ID'] || '',
  openWeatherMapApiKey: process.env['OPENWEATHERMAP_API_KEY'] || '',
  marketPriceApiKey: process.env['MARKET_PRICE_API_KEY'] || '',
  marketPriceApiUrl: process.env['MARKET_PRICE_API_URL'] || '',
  googleCloudApiKey: process.env['GOOGLE_CLOUD_API_KEY'] || '',
  fcmServerKey: process.env['FCM_SERVER_KEY'] || '',
  advisoryEngineUrl: process.env['ADVISORY_ENGINE_URL'] || '',
  visionEngineUrl: process.env['VISION_ENGINE_URL'] || '',
  geminiApiKey: process.env['GEMINI_API_KEY'] || '',
} as const;

export type Config = typeof config;
