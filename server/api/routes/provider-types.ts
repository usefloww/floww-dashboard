/**
 * Provider Types Routes
 *
 * GET /provider-types - List all provider types
 * GET /provider-types/:providerType - Get provider type metadata
 */

import { get, json, errorResponse } from '~/server/api/router';
import {
  getAllProviderDefinitions,
  getProviderDefinition,
} from 'floww/providers/server';

// Backend metadata for display purposes (not in SDK)
const PROVIDER_METADATA: Record<string, { name: string; description: string }> = {
  builtin: {
    name: 'Built-in',
    description: 'Webhooks, cron schedules, and manual triggers',
  },
  discord: {
    name: 'Discord',
    description: 'Discord bot for messages, reactions, and member events',
  },
  github: {
    name: 'GitHub',
    description: 'GitHub repositories, issues, and pull requests',
  },
  gitlab: {
    name: 'GitLab',
    description: 'GitLab repositories and merge requests',
  },
  google_calendar: {
    name: 'Google Calendar',
    description: 'Google Calendar events and scheduling',
  },
  jira: {
    name: 'Jira',
    description: 'Jira Cloud issues and comments',
  },
  kvstore: {
    name: 'Key-Value Store',
    description: 'Persistent key-value storage for workflows',
  },
  slack: {
    name: 'Slack',
    description: 'Slack messages and reactions',
  },
  todoist: {
    name: 'Todoist',
    description: 'Todoist task management',
  },
};

// List all provider types (from SDK registry + backend metadata)
get('/provider-types', async ({ user }) => {
  if (!user) return errorResponse('Unauthorized', 401);

  const allDefs = getAllProviderDefinitions();

  return json({
    results: Object.entries(allDefs).map(([type, def]) => {
      const meta = PROVIDER_METADATA[type] ?? { name: type, description: '' };
      return {
        type,
        name: meta.name,
        description: meta.description,
        triggerTypes: Object.keys(def.triggerDefinitions),
      };
    }),
  });
});

// Get single provider type metadata
get('/provider-types/:providerType', async ({ user, params }) => {
  if (!user) return errorResponse('Unauthorized', 401);

  const { providerType } = params;
  const def = getProviderDefinition(providerType);

  if (!def) {
    return errorResponse(`Unknown provider type: ${providerType}`, 404);
  }

  const meta = PROVIDER_METADATA[providerType] ?? { name: providerType, description: '' };

  return json({
    providerType,
    name: meta.name,
    description: meta.description,
    setupSteps: def.setupSteps,
    triggerTypes: Object.keys(def.triggerDefinitions),
  });
});
