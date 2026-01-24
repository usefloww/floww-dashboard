/**
 * Config Route
 *
 * GET /api/config - Public configuration for the frontend
 */

import { get, json } from '~/server/api/router';

get('/config', async () => {
  return json({
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
  });
}, false); // No auth required
