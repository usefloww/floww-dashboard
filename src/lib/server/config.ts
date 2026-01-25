import { createServerFn } from '@tanstack/react-start';

export interface AppConfig {
  auth: {
    type: string;
    enabled: boolean;
  };
  features: {
    billing: boolean;
    singleOrg: boolean;
  };
  limits: {
    maxWorkflows: number;
    maxExecutionsPerMonth: number;
  };
  version: string;
}

/**
 * Server function to get public configuration
 * This doesn't require authentication
 */
export const getConfig = createServerFn({ method: 'GET' }).handler(async (): Promise<AppConfig> => {
  return {
    auth: {
      type: process.env.AUTH_TYPE ?? 'workos',
      enabled: process.env.AUTH_TYPE !== 'none',
    },
    features: {
      billing: process.env.IS_CLOUD === 'true',
      singleOrg: process.env.SINGLE_ORG_MODE === 'true',
    },
    limits: {
      maxWorkflows: parseInt(process.env.MAX_WORKFLOWS ?? '100', 10),
      maxExecutionsPerMonth: parseInt(process.env.MAX_EXECUTIONS_PER_MONTH ?? '10000', 10),
    },
    version: process.env.npm_package_version ?? '0.0.0',
  };
});

/**
 * Helper to check if billing features are enabled
 */
export const isBillingEnabled = createServerFn({ method: 'GET' }).handler(async (): Promise<boolean> => {
  return process.env.IS_CLOUD === 'true';
});
