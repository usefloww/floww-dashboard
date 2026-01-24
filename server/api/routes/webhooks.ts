/**
 * Webhooks API Routes
 *
 * Public webhook receiver for all HTTP methods.
 * No authentication required - webhooks are public endpoints.
 *
 * POST/GET/PUT/DELETE /webhook/:path - Catch-all webhook handler
 */

import { eq, and } from 'drizzle-orm';
import { get, post, put, del, json } from '~/server/api/router';
import { getDb } from '~/server/db';
import {
  incomingWebhooks,
  triggers,
  providers,
  workflows,
  namespaces,
} from '~/server/db/schema';
import { createExecution } from '~/server/services/execution-service';
import { executeWebhookTrigger } from '~/server/services/trigger-execution-service';
import { checkExecutionLimit } from '~/server/services/billing-service';
import { centrifugoService } from '~/server/services/centrifugo-service';
import { generateInvocationToken } from '~/server/services/workflow-auth-service';

interface WebhookData {
  path: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  query: Record<string, string>;
}

async function handleWebhook(request: Request, path: string): Promise<Response> {
  const db = getDb();

  // Normalize path to always have leading slash and include /webhook/ prefix
  const normalizedPath = path.startsWith('/') ? `/webhook${path}` : `/webhook/${path}`;
  const method = request.method.toUpperCase();

  console.log('Webhook lookup', { path, normalizedPath, method });

  // Query webhook by path and method
  const webhookResults = await db
    .select({
      webhook: incomingWebhooks,
      trigger: triggers,
      provider: providers,
      workflow: workflows,
    })
    .from(incomingWebhooks)
    .leftJoin(triggers, eq(incomingWebhooks.triggerId, triggers.id))
    .leftJoin(providers, eq(incomingWebhooks.providerId, providers.id))
    .leftJoin(workflows, eq(triggers.workflowId, workflows.id))
    .where(and(eq(incomingWebhooks.path, normalizedPath), eq(incomingWebhooks.method, method)))
    .limit(1);

  if (webhookResults.length === 0) {
    return json({ error: 'Webhook not found' }, 404);
  }

  const { webhook, trigger, provider, workflow } = webhookResults[0];

  // Parse request body
  let webhookBody: unknown = {};
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      webhookBody = await request.json();
    } catch {
      webhookBody = {};
    }
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    try {
      const formData = await request.formData();
      webhookBody = Object.fromEntries(formData.entries());
    } catch {
      webhookBody = {};
    }
  }

  // Build webhook data
  const webhookData: WebhookData = {
    path: normalizedPath,
    method,
    headers: Object.fromEntries(request.headers.entries()),
    body: webhookBody,
    query: Object.fromEntries(new URL(request.url).searchParams.entries()),
  };

  // Handle based on webhook ownership
  if (webhook.providerId && provider) {
    // Provider-owned webhook: route to all matching triggers
    return handleProviderWebhook(webhook, provider, webhookData);
  } else if (webhook.triggerId && trigger && workflow) {
    // Trigger-owned webhook: execute single trigger
    return handleTriggerWebhook(webhook, trigger, workflow, webhookData);
  } else {
    console.error('Webhook has neither provider_id nor trigger_id', { webhookId: webhook.id });
    return json({ error: 'Invalid webhook configuration' }, 500);
  }
}

async function handleProviderWebhook(
  webhook: typeof incomingWebhooks.$inferSelect,
  provider: typeof providers.$inferSelect,
  webhookData: WebhookData
): Promise<Response> {
  const db = getDb();

  console.log('Processing provider-owned webhook', {
    webhookId: webhook.id,
    providerId: provider.id,
    providerType: provider.type,
  });

  // Load all triggers for this provider
  const triggerResults = await db
    .select({
      trigger: triggers,
      workflow: workflows,
    })
    .from(triggers)
    .innerJoin(workflows, eq(triggers.workflowId, workflows.id))
    .where(eq(triggers.providerId, provider.id));

  console.log('Loaded triggers for provider', {
    providerId: provider.id,
    triggerCount: triggerResults.length,
  });

  if (triggerResults.length === 0) {
    return json({ message: 'No matching triggers for this event' }, 200);
  }

  // Execute all matching triggers
  const results: Array<{ triggerId: string; executionId: string; status: string }> = [];

  for (const { trigger, workflow } of triggerResults) {
    try {
      // Check execution limit
      const namespaceResult = await db
        .select({ organizationId: namespaces.organizationOwnerId })
        .from(namespaces)
        .where(eq(namespaces.id, workflow.namespaceId))
        .limit(1);

      if (namespaceResult.length > 0 && namespaceResult[0].organizationId) {
        const limitCheck = await checkExecutionLimit(namespaceResult[0].organizationId);
        if (!limitCheck.allowed) {
          console.warn('Execution limit reached', { workflowId: workflow.id });
          continue;
        }
      }

      // Create execution record
      const execution = await createExecution({
        workflowId: workflow.id,
        triggerId: trigger.id,
      });

      // Execute the trigger
      const result = await executeWebhookTrigger(
        trigger.id,
        {
          path: webhookData.path,
          method: webhookData.method,
          headers: webhookData.headers,
          body: webhookData.body,
          query: webhookData.query,
        },
        execution.id
      );

      results.push({
        triggerId: trigger.id,
        executionId: execution.id,
        status: result ? 'executed' : 'no_deployment',
      });
    } catch (error) {
      console.error('Failed to execute trigger', { triggerId: trigger.id, error });
    }
  }

  return json({
    webhookId: webhook.id,
    providerId: provider.id,
    triggersExecuted: results.length,
    results,
  });
}

async function handleTriggerWebhook(
  webhook: typeof incomingWebhooks.$inferSelect,
  trigger: typeof triggers.$inferSelect,
  workflow: typeof workflows.$inferSelect,
  webhookData: WebhookData
): Promise<Response> {
  const db = getDb();

  console.log('Processing trigger-owned webhook', {
    webhookId: webhook.id,
    triggerId: trigger.id,
    workflowId: workflow.id,
  });

  // Check execution limit
  const namespaceResult = await db
    .select({ organizationId: namespaces.organizationOwnerId })
    .from(namespaces)
    .where(eq(namespaces.id, workflow.namespaceId))
    .limit(1);

  if (namespaceResult.length > 0 && namespaceResult[0].organizationId) {
    const limitCheck = await checkExecutionLimit(namespaceResult[0].organizationId);
    if (!limitCheck.allowed) {
      return json(
        {
          title: 'Execution limit reached',
          description: limitCheck.message,
          upgradeRequired: true,
        },
        402
      );
    }
  }

  // Create execution record
  const execution = await createExecution({
    workflowId: workflow.id,
    triggerId: trigger.id,
  });

  // Publish to dev channel for local development
  try {
    const authToken = await generateInvocationToken(workflow.id, workflow.namespaceId, undefined);
    await centrifugoService.publishDevWebhookEvent(
      workflow.id,
      { triggerId: trigger.id },
      {
        type: 'webhook',
        authToken,
        path: webhookData.path,
        method: webhookData.method,
        headers: webhookData.headers,
        body: webhookData.body,
        query: webhookData.query,
      }
    );
  } catch (error) {
    console.error('Failed to publish dev webhook event', { error });
  }

  // Execute the trigger
  const result = await executeWebhookTrigger(
    trigger.id,
    {
      path: webhookData.path,
      method: webhookData.method,
      headers: webhookData.headers,
      body: webhookData.body,
      query: webhookData.query,
    },
    execution.id
  );

  if (!result) {
    return json({
      message: 'No active deployment found, only sent to dev mode.',
      webhookId: webhook.id,
      executionId: execution.id,
    });
  }

  return json({
    webhookId: webhook.id,
    ...result,
  });
}

// Register webhook routes - no auth required
get('/webhook/:path', async ({ params, request }) => handleWebhook(request, params.path), false);
post('/webhook/:path', async ({ params, request }) => handleWebhook(request, params.path), false);
put('/webhook/:path', async ({ params, request }) => handleWebhook(request, params.path), false);
del('/webhook/:path', async ({ params, request }) => handleWebhook(request, params.path), false);
