/**
 * Trigger Service
 *
 * Manages workflow triggers - the events that cause workflows to execute.
 * Supports webhooks, cron schedules, and other trigger types.
 */

import { eq, and, desc } from 'drizzle-orm';
import { getDb } from '~/server/db';
import {
  triggers,
  providers,
  incomingWebhooks,
  recurringTasks,
  workflowDeployments,
  type Provider,
  type IncomingWebhook,
} from '~/server/db/schema';
import { generateUlidUuid } from '~/server/utils/uuid';
import { encryptSecret } from '~/server/utils/encryption';

export interface TriggerInfo {
  id: string;
  workflowId: string;
  providerId: string;
  triggerType: string;
  input: Record<string, unknown>;
  state: Record<string, unknown> | null;
}

export interface TriggerMetadata {
  providerType: string;
  providerAlias: string;
  triggerType: string;
  input: Record<string, unknown>;
}

export interface WebhookInfo {
  id: string;
  url: string;
  path: string;
  method: string;
  providerType: string;
  providerAlias: string;
  triggerType: string;
  triggerId: string;
}

/**
 * Get a trigger by ID
 */
export async function getTrigger(triggerId: string): Promise<TriggerInfo | null> {
  const db = getDb();

  const [trigger] = await db.select().from(triggers).where(eq(triggers.id, triggerId)).limit(1);

  if (!trigger) {
    return null;
  }

  return {
    id: trigger.id,
    workflowId: trigger.workflowId,
    providerId: trigger.providerId,
    triggerType: trigger.triggerType,
    input: trigger.input as Record<string, unknown>,
    state: trigger.state as Record<string, unknown> | null,
  };
}

/**
 * List triggers for a workflow
 */
export async function listTriggers(workflowId: string): Promise<TriggerInfo[]> {
  const db = getDb();

  const result = await db.select().from(triggers).where(eq(triggers.workflowId, workflowId));

  return result.map((t) => ({
    id: t.id,
    workflowId: t.workflowId,
    providerId: t.providerId,
    triggerType: t.triggerType,
    input: t.input as Record<string, unknown>,
    state: t.state as Record<string, unknown> | null,
  }));
}

/**
 * Create a trigger identity key for comparison
 */
function getTriggerIdentity(meta: TriggerMetadata): string {
  return `${meta.providerType}:${meta.providerAlias}:${meta.triggerType}:${JSON.stringify(meta.input, Object.keys(meta.input).sort())}`;
}

/**
 * Ensure a provider exists, auto-creating if it has no setup steps
 */
async function ensureProviderExists(
  namespaceId: string,
  providerType: string,
  providerAlias: string
): Promise<void> {
  const db = getDb();

  // Check if provider already exists
  const [existing] = await db
    .select()
    .from(providers)
    .where(
      and(
        eq(providers.namespaceId, namespaceId),
        eq(providers.type, providerType),
        eq(providers.alias, providerAlias)
      )
    )
    .limit(1);

  if (existing) {
    return;
  }

  // Providers that can be auto-created (no setup required)
  const autoCreateProviders = ['builtin', 'kvstore'];

  if (!autoCreateProviders.includes(providerType)) {
    console.warn(`Provider ${providerType}:${providerAlias} requires setup and cannot be auto-created`);
    return;
  }

  // Auto-create the provider
  await db.insert(providers).values({
    id: generateUlidUuid(),
    namespaceId,
    type: providerType,
    alias: providerAlias,
    encryptedConfig: encryptSecret('{}'),
  });

  console.log(`Auto-created ${providerType} provider: ${providerAlias}`);
}

/**
 * Get provider by type and alias
 */
async function getProviderByTypeAlias(
  namespaceId: string,
  providerType: string,
  providerAlias: string
): Promise<Provider | null> {
  const db = getDb();

  const [provider] = await db
    .select()
    .from(providers)
    .where(
      and(
        eq(providers.namespaceId, namespaceId),
        eq(providers.type, providerType),
        eq(providers.alias, providerAlias)
      )
    )
    .limit(1);

  return provider ?? null;
}

/**
 * Create a new trigger
 */
export async function createTrigger(params: {
  workflowId: string;
  providerId: string;
  triggerType: string;
  input: Record<string, unknown>;
  state?: Record<string, unknown>;
}): Promise<TriggerInfo> {
  const db = getDb();

  const [trigger] = await db
    .insert(triggers)
    .values({
      id: generateUlidUuid(),
      workflowId: params.workflowId,
      providerId: params.providerId,
      triggerType: params.triggerType,
      input: params.input,
      state: params.state ?? {},
    })
    .returning();

  return {
    id: trigger.id,
    workflowId: trigger.workflowId,
    providerId: trigger.providerId,
    triggerType: trigger.triggerType,
    input: trigger.input as Record<string, unknown>,
    state: trigger.state as Record<string, unknown> | null,
  };
}

/**
 * Update a trigger's state
 */
export async function updateTriggerState(
  triggerId: string,
  state: Record<string, unknown>
): Promise<TriggerInfo | null> {
  const db = getDb();

  const [trigger] = await db
    .update(triggers)
    .set({ state })
    .where(eq(triggers.id, triggerId))
    .returning();

  if (!trigger) {
    return null;
  }

  return {
    id: trigger.id,
    workflowId: trigger.workflowId,
    providerId: trigger.providerId,
    triggerType: trigger.triggerType,
    input: trigger.input as Record<string, unknown>,
    state: trigger.state as Record<string, unknown> | null,
  };
}

/**
 * Delete a trigger
 */
export async function deleteTrigger(triggerId: string): Promise<boolean> {
  const db = getDb();

  await db.delete(triggers).where(eq(triggers.id, triggerId));

  return true;
}

/**
 * Get deployed trigger identities for a workflow
 * These triggers should be preserved and not removed during dev sync
 */
async function getDeployedTriggerIdentities(workflowId: string): Promise<Set<string>> {
  const db = getDb();

  // Find active deployment
  const [deployment] = await db
    .select()
    .from(workflowDeployments)
    .where(
      and(eq(workflowDeployments.workflowId, workflowId), eq(workflowDeployments.status, 'active'))
    )
    .orderBy(desc(workflowDeployments.deployedAt))
    .limit(1);

  if (!deployment || !deployment.triggerDefinitions) {
    return new Set();
  }

  const triggerDefs = deployment.triggerDefinitions as Array<{
    provider: { type: string; alias: string };
    triggerType: string;
    input?: Record<string, unknown>;
  }>;

  const identities = new Set<string>();
  for (const def of triggerDefs) {
    const identity = getTriggerIdentity({
      providerType: def.provider.type,
      providerAlias: def.provider.alias,
      triggerType: def.triggerType,
      input: def.input ?? {},
    });
    identities.add(identity);
  }

  return identities;
}

/**
 * Sync triggers for a workflow.
 * Returns list of webhook info for created/existing webhooks.
 */
export async function syncTriggers(
  workflowId: string,
  namespaceId: string,
  newTriggersMetadata: TriggerMetadata[]
): Promise<WebhookInfo[]> {
  const db = getDb();
  const publicApiUrl = process.env.PUBLIC_API_URL ?? 'http://localhost:3000';

  // Ensure builtin provider exists
  await ensureProviderExists(namespaceId, 'builtin', 'default');

  // Filter valid triggers
  const newTriggers = newTriggersMetadata.filter(
    (t) => t.providerType && t.providerAlias
  );

  // Auto-create providers with no setup steps
  const uniqueProviders = new Set(newTriggers.map((t) => `${t.providerType}:${t.providerAlias}`));
  for (const providerKey of uniqueProviders) {
    const [providerType, providerAlias] = providerKey.split(':');
    await ensureProviderExists(namespaceId, providerType, providerAlias);
  }

  // Load existing triggers
  const existingTriggers = await listTriggers(workflowId);

  // Build identity maps
  const existingMap = new Map<string, TriggerInfo>();
  for (const trigger of existingTriggers) {
    const [provider] = await db
      .select()
      .from(providers)
      .where(eq(providers.id, trigger.providerId))
      .limit(1);

    if (provider) {
      const identity = getTriggerIdentity({
        providerType: provider.type,
        providerAlias: provider.alias,
        triggerType: trigger.triggerType,
        input: trigger.input,
      });
      existingMap.set(identity, trigger);
    }
  }

  const newMap = new Map<string, TriggerMetadata>();
  for (const meta of newTriggers) {
    const identity = getTriggerIdentity(meta);
    newMap.set(identity, meta);
  }

  // Get deployed trigger identities to preserve
  const deployedIdentities = await getDeployedTriggerIdentities(workflowId);

  // Compute sets
  const existingIdentities = new Set(existingMap.keys());
  const newIdentities = new Set(newMap.keys());

  // to_remove = (existing - new) - deployed
  const toRemove = new Set<string>();
  for (const id of existingIdentities) {
    if (!newIdentities.has(id) && !deployedIdentities.has(id)) {
      toRemove.add(id);
    }
  }

  // to_add = new - existing
  const toAdd = new Set<string>();
  for (const id of newIdentities) {
    if (!existingIdentities.has(id)) {
      toAdd.add(id);
    }
  }

  // to_keep = existing & new
  const toKeep = new Set<string>();
  for (const id of existingIdentities) {
    if (newIdentities.has(id)) {
      toKeep.add(id);
    }
  }

  console.log('Trigger sync plan', {
    workflowId,
    toRemove: toRemove.size,
    toAdd: toAdd.size,
    toKeep: toKeep.size,
    deployedProtected: deployedIdentities.size,
  });

  // Remove triggers
  for (const identity of toRemove) {
    const trigger = existingMap.get(identity);
    if (trigger) {
      await deleteTrigger(trigger.id);
    }
  }

  // Add triggers
  const errors: Array<{ providerType: string; triggerType: string; error: string }> = [];
  for (const identity of toAdd) {
    const meta = newMap.get(identity)!;
    try {
      const provider = await getProviderByTypeAlias(namespaceId, meta.providerType, meta.providerAlias);
      if (!provider) {
        throw new Error(`Provider ${meta.providerType}:${meta.providerAlias} not found`);
      }

      const trigger = await createTrigger({
        workflowId,
        providerId: provider.id,
        triggerType: meta.triggerType,
        input: meta.input,
      });

      // For webhook triggers, create incoming webhook
      if (meta.triggerType === 'webhook' || meta.triggerType === 'onWebhook') {
        const webhookPath = `/webhook/${generateUlidUuid()}`;
        await db.insert(incomingWebhooks).values({
          id: generateUlidUuid(),
          triggerId: trigger.id,
          providerId: null,
          path: webhookPath,
          method: 'POST',
        });
      }

      // For cron triggers, create recurring task
      if (meta.triggerType === 'cron' || meta.triggerType === 'onSchedule') {
        await db.insert(recurringTasks).values({
          id: generateUlidUuid(),
          triggerId: trigger.id,
        });
      }
    } catch (error) {
      errors.push({
        providerType: meta.providerType,
        triggerType: meta.triggerType,
        error: String(error),
      });
      console.error('Failed to create trigger', { meta, error: String(error) });
    }
  }

  // Collect webhook info
  const webhooksInfo: WebhookInfo[] = [];
  const seenIds = new Set<string>();

  // Get all current triggers
  const allCurrentTriggers = await listTriggers(workflowId);

  for (const trigger of allCurrentTriggers) {
    // Get webhook for this trigger
    const [webhook] = await db
      .select()
      .from(incomingWebhooks)
      .where(eq(incomingWebhooks.triggerId, trigger.id))
      .limit(1);

    if (webhook && !seenIds.has(webhook.id)) {
      const [provider] = await db
        .select()
        .from(providers)
        .where(eq(providers.id, trigger.providerId))
        .limit(1);

      if (provider) {
        webhooksInfo.push({
          id: webhook.id,
          url: `${publicApiUrl}${webhook.path}`,
          path: webhook.path,
          method: webhook.method,
          providerType: provider.type,
          providerAlias: provider.alias,
          triggerType: trigger.triggerType,
          triggerId: trigger.id,
        });
        seenIds.add(webhook.id);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(
      JSON.stringify({
        message: 'Failed to create one or more triggers',
        failed_triggers: errors,
      })
    );
  }

  return webhooksInfo;
}

/**
 * Get webhook for a trigger
 */
export async function getTriggerWebhook(triggerId: string): Promise<IncomingWebhook | null> {
  const db = getDb();

  const [webhook] = await db
    .select()
    .from(incomingWebhooks)
    .where(eq(incomingWebhooks.triggerId, triggerId))
    .limit(1);

  return webhook ?? null;
}

/**
 * Get trigger by webhook path
 */
export async function getTriggerByWebhookPath(path: string): Promise<TriggerInfo | null> {
  const db = getDb();

  const result = await db
    .select({ trigger: triggers })
    .from(incomingWebhooks)
    .innerJoin(triggers, eq(incomingWebhooks.triggerId, triggers.id))
    .where(eq(incomingWebhooks.path, path))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const { trigger } = result[0];
  return {
    id: trigger.id,
    workflowId: trigger.workflowId,
    providerId: trigger.providerId,
    triggerType: trigger.triggerType,
    input: trigger.input as Record<string, unknown>,
    state: trigger.state as Record<string, unknown> | null,
  };
}
