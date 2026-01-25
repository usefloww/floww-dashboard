/**
 * Settings Configuration
 *
 * Centralized settings system similar to Python backend's settings.py.
 * Supports Docker secrets via *_FILE environment variables.
 *
 * Priority order (highest to lowest):
 * 1. Docker secrets (from files when *_FILE env vars exist)
 * 2. Environment variables
 * 3. Default values
 */

import { z } from 'zod';
import { getEnvWithSecret } from './utils/docker-secrets';
import { logger } from './utils/logger';

// ============================================================================
// Database Configuration
// ============================================================================

const DatabaseConfigSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  TEST_DATABASE_URL: z.string().default('postgresql://admin:secret@localhost:5432/floww_test'),
  SESSION_SECRET_KEY: z.string().min(1, 'SESSION_SECRET_KEY is required'),
  ENCRYPTION_KEY: z.string().min(1, 'ENCRYPTION_KEY is required'),
});

function loadDatabaseConfig(): z.infer<typeof DatabaseConfigSchema> {
  // Support constructing DATABASE_URL from parts (for Docker secrets compatibility)
  const dbUrl = getEnvWithSecret('DATABASE_URL');
  const dbUser = getEnvWithSecret('DATABASE_USER') || 'postgres';
  const dbPassword = getEnvWithSecret('DATABASE_PASSWORD');
  const dbHost = getEnvWithSecret('DATABASE_HOST');
  const dbPort = getEnvWithSecret('DATABASE_PORT') || '5432';
  const dbName = getEnvWithSecret('DATABASE_NAME') || 'postgres';

  // If DATABASE_URL is provided, use it; otherwise construct from parts
  let databaseUrl = dbUrl;
  if (!databaseUrl && dbPassword && dbHost) {
    const sslMode = getEnvWithSecret('DATABASE_SSL') || 'require';
    databaseUrl = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}?sslmode=${sslMode}`;
  }
  databaseUrl = databaseUrl || 'postgresql://admin:secret@localhost:5432/postgres';

  return {
    DATABASE_URL: databaseUrl,
    TEST_DATABASE_URL: getEnvWithSecret('TEST_DATABASE_URL') || 'postgresql://admin:secret@localhost:5432/floww_test',
    SESSION_SECRET_KEY: getEnvWithSecret('SESSION_SECRET_KEY') || 'floww-session-secret-change-in-production',
    ENCRYPTION_KEY: getEnvWithSecret('ENCRYPTION_KEY') || 'OTLHgX6E8_3k-c6rHBsbHDKnuPGtmD1ycNip9CgfiFk=',
  };
}

// ============================================================================
// Auth Configuration
// ============================================================================

const AuthConfigSchema = z.object({
  AUTH_TYPE: z.enum(['workos', 'oidc', 'password', 'none']).default('workos'),
  WORKOS_API_KEY: z.string().optional(),
  WORKOS_CLIENT_ID: z.string().optional(),
  AUTH_CLIENT_ID: z.string().optional(),
  AUTH_CLIENT_SECRET: z.string().optional(),
  AUTH_ISSUER_URL: z.preprocess((val) => (val === '' ? undefined : val), z.string().url().optional()),
  BETTER_AUTH_SECRET: z.string().optional(),
  BETTER_AUTH_URL: z.preprocess((val) => (val === '' ? undefined : val), z.string().url().optional()),
  WORKFLOW_JWT_SECRET: z.string().optional(),
});

function loadAuthConfig(): z.infer<typeof AuthConfigSchema> {
  return {
    AUTH_TYPE: (getEnvWithSecret('AUTH_TYPE') as 'workos' | 'oidc' | 'password' | 'none') || 'workos',
    WORKOS_API_KEY: getEnvWithSecret('WORKOS_API_KEY'),
    WORKOS_CLIENT_ID: getEnvWithSecret('WORKOS_CLIENT_ID'),
    AUTH_CLIENT_ID: getEnvWithSecret('AUTH_CLIENT_ID'),
    AUTH_CLIENT_SECRET: getEnvWithSecret('AUTH_CLIENT_SECRET'),
    AUTH_ISSUER_URL: getEnvWithSecret('AUTH_ISSUER_URL'),
    BETTER_AUTH_SECRET: getEnvWithSecret('BETTER_AUTH_SECRET'),
    BETTER_AUTH_URL: getEnvWithSecret('BETTER_AUTH_URL'),
    WORKFLOW_JWT_SECRET: getEnvWithSecret('WORKFLOW_JWT_SECRET'),
  };
}

// ============================================================================
// Centrifugo Configuration
// ============================================================================

const CentrifugoConfigSchema = z.object({
  CENTRIFUGO_PUBLIC_URL: z.string().url().default('http://localhost:8000'),
  CENTRIFUGO_API_KEY: z.string().min(1, 'CENTRIFUGO_API_KEY is required'),
  CENTRIFUGO_JWT_SECRET: z.string().min(1, 'CENTRIFUGO_JWT_SECRET is required'),
});

function loadCentrifugoConfig(): z.infer<typeof CentrifugoConfigSchema> {
  return {
    CENTRIFUGO_PUBLIC_URL: getEnvWithSecret('CENTRIFUGO_PUBLIC_URL') || 'http://localhost:8000',
    CENTRIFUGO_API_KEY: getEnvWithSecret('CENTRIFUGO_API_KEY') || 'floww-api-key-dev',
    CENTRIFUGO_JWT_SECRET: getEnvWithSecret('CENTRIFUGO_JWT_SECRET') || 'floww-dev-jwt-secret-key-change-in-production',
  };
}

// ============================================================================
// Stripe Configuration
// ============================================================================

const StripeConfigSchema = z.object({
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_PRICE_ID_HOBBY: z.string().optional(),
  STRIPE_PRICE_ID_TEAM: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  TRIAL_PERIOD_DAYS: z.number().default(0),
  GRACE_PERIOD_DAYS: z.number().default(7),
});

function loadStripeConfig(): z.infer<typeof StripeConfigSchema> {
  const trialPeriod = getEnvWithSecret('TRIAL_PERIOD_DAYS');
  const gracePeriod = getEnvWithSecret('GRACE_PERIOD_DAYS');
  return {
    STRIPE_SECRET_KEY: getEnvWithSecret('STRIPE_SECRET_KEY'),
    STRIPE_PUBLISHABLE_KEY: getEnvWithSecret('STRIPE_PUBLISHABLE_KEY'),
    STRIPE_PRICE_ID_HOBBY: getEnvWithSecret('STRIPE_PRICE_ID_HOBBY'),
    STRIPE_PRICE_ID_TEAM: getEnvWithSecret('STRIPE_PRICE_ID_TEAM'),
    STRIPE_WEBHOOK_SECRET: getEnvWithSecret('STRIPE_WEBHOOK_SECRET'),
    TRIAL_PERIOD_DAYS: trialPeriod ? parseInt(trialPeriod, 10) : 0,
    GRACE_PERIOD_DAYS: gracePeriod ? parseInt(gracePeriod, 10) : 7,
  };
}

// ============================================================================
// General Configuration
// ============================================================================

const GeneralConfigSchema = z.object({
  BACKEND_URL: z.string().url().default('http://localhost:8000'),
  PUBLIC_API_URL: z.preprocess((val) => (val === '' ? undefined : val), z.string().url().optional()),
  ENABLE_ADMIN: z.boolean().default(true),
  ADMIN_EMAIL: z.preprocess((val) => (val === '' ? undefined : val), z.string().email().optional()),
  ADMIN_PASSWORD: z.string().optional(),
  SINGLE_ORG_MODE: z.boolean().default(false),
  SINGLE_ORG_NAME: z.string().default('default'),
  SINGLE_ORG_DISPLAY_NAME: z.string().default('Default Organization'),
  IS_CLOUD: z.boolean().default(false),
  SENTRY_DSN: z.preprocess((val) => (val === '' ? undefined : val), z.string().url().optional()),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.number().min(0).max(1).optional(),
  SENTRY_PROFILES_SAMPLE_RATE: z.number().min(0).max(1).optional(),
});

function loadGeneralConfig(): z.infer<typeof GeneralConfigSchema> {
  const enableAdmin = getEnvWithSecret('ENABLE_ADMIN');
  const singleOrgMode = getEnvWithSecret('SINGLE_ORG_MODE');
  const isCloud = getEnvWithSecret('IS_CLOUD');
  const tracesSampleRate = getEnvWithSecret('SENTRY_TRACES_SAMPLE_RATE');
  const profilesSampleRate = getEnvWithSecret('SENTRY_PROFILES_SAMPLE_RATE');

  return {
    BACKEND_URL: getEnvWithSecret('BACKEND_URL') || 'http://localhost:8000',
    PUBLIC_API_URL: getEnvWithSecret('PUBLIC_API_URL'),
    ENABLE_ADMIN: enableAdmin !== 'false' && enableAdmin !== '0',
    ADMIN_EMAIL: getEnvWithSecret('ADMIN_EMAIL'),
    ADMIN_PASSWORD: getEnvWithSecret('ADMIN_PASSWORD'),
    SINGLE_ORG_MODE: singleOrgMode === 'true' || singleOrgMode === '1',
    SINGLE_ORG_NAME: getEnvWithSecret('SINGLE_ORG_NAME') || 'default',
    SINGLE_ORG_DISPLAY_NAME: getEnvWithSecret('SINGLE_ORG_DISPLAY_NAME') || 'Default Organization',
    IS_CLOUD: isCloud === 'true' || isCloud === '1',
    SENTRY_DSN: getEnvWithSecret('SENTRY_DSN'),
    SENTRY_ENVIRONMENT: getEnvWithSecret('SENTRY_ENVIRONMENT') || getEnvWithSecret('NODE_ENV') || 'development',
    SENTRY_RELEASE: getEnvWithSecret('SENTRY_RELEASE') || getEnvWithSecret('npm_package_version'),
    SENTRY_TRACES_SAMPLE_RATE: tracesSampleRate ? parseFloat(tracesSampleRate) : undefined,
    SENTRY_PROFILES_SAMPLE_RATE: profilesSampleRate ? parseFloat(profilesSampleRate) : undefined,
  };
}

// ============================================================================
// AI Configuration
// ============================================================================

const AIConfigSchema = z.object({
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.preprocess((val) => (val === '' ? undefined : val), z.string().url().optional()),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_PROVIDER: z.string().optional(),
  AI_MODEL: z.string().optional(),
});

function loadAIConfig(): z.infer<typeof AIConfigSchema> {
  return {
    OPENAI_API_KEY: getEnvWithSecret('OPENAI_API_KEY'),
    OPENAI_BASE_URL: getEnvWithSecret('OPENAI_BASE_URL'),
    ANTHROPIC_API_KEY: getEnvWithSecret('ANTHROPIC_API_KEY'),
    AI_PROVIDER: getEnvWithSecret('AI_PROVIDER'),
    AI_MODEL: getEnvWithSecret('AI_MODEL'),
  };
}

// ============================================================================
// Worker Configuration
// ============================================================================

const WorkerConfigSchema = z.object({
  ENABLE_WORKER: z.boolean().default(false),
  WORKER_ONLY: z.boolean().default(false),
});

function loadWorkerConfig(): z.infer<typeof WorkerConfigSchema> {
  const enableWorker = getEnvWithSecret('ENABLE_WORKER');
  const workerOnly = getEnvWithSecret('WORKER_ONLY');

  return {
    ENABLE_WORKER: enableWorker === 'true' || enableWorker === '1',
    WORKER_ONLY: workerOnly === 'true' || workerOnly === '1',
  };
}

// ============================================================================
// Combined Settings Schema
// ============================================================================

const SettingsSchema = z.object({
  database: DatabaseConfigSchema,
  auth: AuthConfigSchema,
  centrifugo: CentrifugoConfigSchema,
  stripe: StripeConfigSchema,
  general: GeneralConfigSchema,
  ai: AIConfigSchema,
  worker: WorkerConfigSchema,
});

type Settings = z.infer<typeof SettingsSchema>;

// ============================================================================
// Settings Loader and Validation
// ============================================================================

function loadSettings(): Settings {
  const rawSettings = {
    database: loadDatabaseConfig(),
    auth: loadAuthConfig(),
    centrifugo: loadCentrifugoConfig(),
    stripe: loadStripeConfig(),
    general: loadGeneralConfig(),
    ai: loadAIConfig(),
    worker: loadWorkerConfig(),
  };

  // Validate settings
  const result = SettingsSchema.safeParse(rawSettings);

  if (!result.success) {
    logger.error('Settings validation failed:', result.error.format());
    throw new Error(`Invalid settings configuration: ${result.error.message}`);
  }

  // Validate AUTH_TYPE='none' requires SINGLE_ORG_MODE=true
  if (result.data.auth.AUTH_TYPE === 'none' && !result.data.general.SINGLE_ORG_MODE) {
    throw new Error(
      "AUTH_TYPE='none' (anonymous authentication) requires SINGLE_ORG_MODE=true. " +
        'Anonymous authentication is only supported in single-organization mode.'
    );
  }

  return result.data;
}

// ============================================================================
// Export Singleton Settings Instance
// ============================================================================

export const settings: Settings = loadSettings();

// Export types for use in other modules
export type { Settings };
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type CentrifugoConfig = z.infer<typeof CentrifugoConfigSchema>;
export type StripeConfig = z.infer<typeof StripeConfigSchema>;
export type GeneralConfig = z.infer<typeof GeneralConfigSchema>;
export type AIConfig = z.infer<typeof AIConfigSchema>;
export type WorkerConfig = z.infer<typeof WorkerConfigSchema>;
