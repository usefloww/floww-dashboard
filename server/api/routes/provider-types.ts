/**
 * Provider Types Routes
 *
 * GET /provider-types - List all provider types
 * GET /provider-types/:providerType - Get provider type metadata
 */

import { get, json, errorResponse } from '~/server/api/router';

// Provider type metadata
const PROVIDER_TYPES: Record<
  string,
  {
    name: string;
    description: string;
    category: string;
    configSchema: Record<string, unknown>;
    triggerTypes: string[];
  }
> = {
  slack: {
    name: 'Slack',
    description: 'Send messages and interact with Slack workspaces',
    category: 'messaging',
    configSchema: {
      type: 'object',
      properties: {
        botToken: { type: 'string', description: 'Slack Bot Token' },
        signingSecret: { type: 'string', description: 'Slack Signing Secret' },
      },
      required: ['botToken'],
    },
    triggerTypes: ['message', 'event', 'command'],
  },
  github: {
    name: 'GitHub',
    description: 'Interact with GitHub repositories and actions',
    category: 'development',
    configSchema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', description: 'GitHub Personal Access Token' },
        webhookSecret: { type: 'string', description: 'Webhook Secret' },
      },
      required: ['accessToken'],
    },
    triggerTypes: ['push', 'pull_request', 'issue', 'release'],
  },
  gitlab: {
    name: 'GitLab',
    description: 'Interact with GitLab repositories and pipelines',
    category: 'development',
    configSchema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', description: 'GitLab Personal Access Token' },
        webhookSecret: { type: 'string', description: 'Webhook Secret' },
      },
      required: ['accessToken'],
    },
    triggerTypes: ['push', 'merge_request', 'pipeline', 'issue'],
  },
  google: {
    name: 'Google',
    description: 'Access Google services (Sheets, Drive, Calendar)',
    category: 'productivity',
    configSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'OAuth Client ID' },
        clientSecret: { type: 'string', description: 'OAuth Client Secret' },
      },
      required: ['clientId', 'clientSecret'],
    },
    triggerTypes: [],
  },
  stripe: {
    name: 'Stripe',
    description: 'Process payments and manage subscriptions',
    category: 'payments',
    configSchema: {
      type: 'object',
      properties: {
        secretKey: { type: 'string', description: 'Stripe Secret Key' },
        webhookSecret: { type: 'string', description: 'Webhook Signing Secret' },
      },
      required: ['secretKey'],
    },
    triggerTypes: ['payment_intent', 'customer', 'subscription', 'invoice'],
  },
  webhook: {
    name: 'Webhook',
    description: 'Generic webhook receiver',
    category: 'integration',
    configSchema: {
      type: 'object',
      properties: {
        secret: { type: 'string', description: 'Webhook Secret for validation' },
      },
    },
    triggerTypes: ['webhook'],
  },
  cron: {
    name: 'Cron',
    description: 'Schedule recurring tasks',
    category: 'scheduling',
    configSchema: {
      type: 'object',
      properties: {},
    },
    triggerTypes: ['cron'],
  },
  kv: {
    name: 'Key-Value Store',
    description: 'Persistent key-value storage for workflows',
    category: 'storage',
    configSchema: {
      type: 'object',
      properties: {},
    },
    triggerTypes: [],
  },
  http: {
    name: 'HTTP',
    description: 'Make HTTP requests to external APIs',
    category: 'integration',
    configSchema: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string', description: 'Base URL for requests' },
        headers: {
          type: 'object',
          description: 'Default headers',
          additionalProperties: { type: 'string' },
        },
      },
    },
    triggerTypes: [],
  },
};

// List all provider types
get('/provider-types', async ({ user }) => {
  if (!user) return errorResponse('Unauthorized', 401);

  return json({
    results: Object.entries(PROVIDER_TYPES).map(([type, meta]) => ({
      type,
      name: meta.name,
      description: meta.description,
      category: meta.category,
      triggerTypes: meta.triggerTypes,
    })),
  });
});

// Get single provider type metadata
get('/provider-types/:providerType', async ({ user, params }) => {
  if (!user) return errorResponse('Unauthorized', 401);

  const { providerType } = params;
  const meta = PROVIDER_TYPES[providerType];

  if (!meta) {
    return errorResponse(`Unknown provider type: ${providerType}`, 404);
  }

  return json({
    type: providerType,
    ...meta,
  });
});
