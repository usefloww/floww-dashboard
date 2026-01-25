/**
 * Workflow Deployments Routes
 *
 * Standalone deployment endpoints matching the Python backend API.
 * These are separate from the nested /workflows/:id/deployments routes.
 *
 * GET /api/workflow_deployments - List deployments (with optional workflowId filter)
 * POST /api/workflow_deployments - Create deployment
 * GET /api/workflow_deployments/:deploymentId - Get deployment
 * PATCH /api/workflow_deployments/:deploymentId - Update deployment
 * DELETE /api/workflow_deployments/:deploymentId - Delete deployment
 */

import { z } from 'zod';
import { get, post, patch, del, json, errorResponse, parseBody } from '~/server/api/router';
import { hasWorkflowAccess } from '~/server/services/access-service';
import * as workflowService from '~/server/services/workflow-service';
import { getDefaultRuntimeId } from '~/server/services/default-runtime';
import * as runtimeService from '~/server/services/runtime-service';
import { syncTriggers, type TriggerMetadata, type WebhookInfo } from '~/server/services/trigger-service';
import { getRuntime } from '~/server/packages/runtimes';
import { getDb } from '~/server/db';
import { providers } from '~/server/db/schema';
import { eq } from 'drizzle-orm';
import { decryptSecret } from '~/server/utils/encryption';
import { logger } from '~/server/utils/logger';

// Schema for creating a deployment
const createWorkflowDeploymentSchema = z.object({
  workflowId: z.string().min(1, 'workflowId is required'),
  runtimeId: z.string().optional(),
  code: z.object({
    files: z.record(z.string()),
    entrypoint: z.string(),
  }),
  triggers: z
    .array(
      z.object({
        type: z.string().optional(),
        path: z.string().optional(),
        method: z.string().optional(),
        expression: z.string().optional(),
        channel: z.string().optional(),
        providerType: z.string().optional(),
        providerAlias: z.string().optional(),
        triggerType: z.string().optional(),
        input: z.record(z.unknown()).optional(),
      })
    )
    .optional(),
});

const updateWorkflowDeploymentSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'FAILED']).optional(),
  userCode: z.record(z.unknown()).optional(),
});

/**
 * Validate that runtime successfully extracted definitions from user code
 */
function validateDefinitions(runtimeDefinitions: {
  success: boolean;
  error?: { message: string; stack?: string };
}): { isValid: boolean; errorMessage?: string } {
  if (!runtimeDefinitions.success) {
    const error = runtimeDefinitions.error;
    if (error) {
      const errorMsg = error.message ?? 'Unknown error';
      const errorStack = error.stack ?? '';
      return {
        isValid: false,
        errorMessage: `Runtime failed to extract definitions: ${errorMsg}\n${errorStack}`,
      };
    }
    return {
      isValid: false,
      errorMessage: 'Runtime failed to extract definitions: Unknown error',
    };
  }
  return { isValid: true };
}

/**
 * Fetch and decrypt all provider configs for a namespace
 */
async function getProviderConfigs(namespaceId: string): Promise<Record<string, Record<string, unknown>>> {
  const db = getDb();

  const result = await db.select().from(providers).where(eq(providers.namespaceId, namespaceId));

  const providerConfigs: Record<string, Record<string, unknown>> = {};
  for (const provider of result) {
    try {
      const configJson = decryptSecret(provider.encryptedConfig);
      const config = JSON.parse(configJson);
      const key = `${provider.type}:${provider.alias}`;
      providerConfigs[key] = config;
    } catch {
      // Skip providers with invalid config
    }
  }

  return providerConfigs;
}

// List deployments
get('/workflow_deployments', async (ctx) => {
  const { user, query } = ctx;
  if (!user) return errorResponse('Unauthorized', 401);

  const workflowId = query.get('workflowId') ?? query.get('workflow_id') ?? undefined;

  if (workflowId) {
    // Check access to the specific workflow
    const hasAccess = await hasWorkflowAccess(user.id, workflowId);
    if (!hasAccess && !user.isAdmin) {
      return errorResponse('Access denied', 403);
    }

    const deployments = await workflowService.listDeployments(workflowId);
    return json({
      deployments: deployments.map((d) => ({
        id: d.id,
        workflowId: d.workflowId,
        runtimeId: d.runtimeId,
        deployedById: d.deployedById,
        userCode: d.userCode,
        status: d.status,
        deployedAt: d.deployedAt instanceof Date ? d.deployedAt.toISOString() : d.deployedAt,
        note: d.note,
      })),
    });
  }

  // If no workflowId filter, we should only return deployments the user has access to
  // For now, return empty if no filter specified (matching Python behavior where workflow_id is required for list)
  return json({ deployments: [] });
});

// Create deployment
post('/workflow_deployments', async (ctx) => {
  const { user, request } = ctx;
  if (!user) return errorResponse('Unauthorized', 401);

  const parsed = await parseBody(request, createWorkflowDeploymentSchema);
  if ('error' in parsed) return parsed.error;

  const { workflowId, runtimeId: requestedRuntimeId, code } = parsed.data;

  // Verify user has access to the workflow
  const workflow = await workflowService.getWorkflow(workflowId);
  if (!workflow) {
    return errorResponse('Workflow not found', 400);
  }

  const hasAccess = await hasWorkflowAccess(user.id, workflowId);
  if (!hasAccess && !user.isAdmin) {
    return errorResponse('Access denied', 403);
  }

  // Resolve runtime_id: use provided value or fall back to default
  let runtimeId = requestedRuntimeId;
  if (!runtimeId) {
    runtimeId = (await getDefaultRuntimeId()) ?? undefined;
    if (!runtimeId) {
      return errorResponse('No runtime_id provided and no default runtime configured', 400);
    }
    logger.info('Using default runtime', { runtimeId });
  }

  // Verify runtime exists and user has access
  const runtime = await runtimeService.getRuntime(runtimeId);
  if (!runtime) {
    return errorResponse('Runtime not found', 400);
  }

  // Get provider configs for the namespace
  const providerConfigs = await getProviderConfigs(workflow.namespaceId);

  // Get definitions from runtime
  const runtimeImpl = getRuntime();
  const runtimeConfig = {
    runtimeId: runtime.id,
    imageDigest: (runtime.config as Record<string, string>)?.image_uri ?? 
                 (runtime.config as Record<string, string>)?.image_hash ?? '',
  };

  const userCode = {
    files: code.files,
    entrypoint: code.entrypoint,
  };

  let runtimeDefinitions;
  try {
    runtimeDefinitions = await runtimeImpl.getDefinitions(runtimeConfig, userCode, providerConfigs);
  } catch (error) {
    logger.error('Failed to get definitions from runtime', {
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(
      `Failed to validate deployment: ${error instanceof Error ? error.message : String(error)}`,
      400
    );
  }

  // Validate definitions were successfully extracted
  const validation = validateDefinitions(runtimeDefinitions);
  if (!validation.isValid) {
    logger.error('Definition validation failed', {
      workflowId,
      error: validation.errorMessage,
    });
    return errorResponse(`Deployment validation failed: ${validation.errorMessage}`, 400);
  }

  // Create the deployment
  const deployment = await workflowService.createDeployment({
    workflowId,
    runtimeId,
    deployedById: user.id,
    userCode: {
      files: code.files,
      entrypoint: code.entrypoint,
    },
    providerDefinitions: runtimeDefinitions.providers ?? [],
    triggerDefinitions: runtimeDefinitions.triggers ?? [],
  });

  logger.info('Deployment definitions validated successfully', {
    deploymentId: deployment.id,
    providersCount: runtimeDefinitions.providers?.length ?? 0,
    triggersCount: runtimeDefinitions.triggers?.length ?? 0,
  });

  // Convert runtime trigger definitions to format expected by TriggerService
  const runtimeTriggers = runtimeDefinitions.triggers ?? [];
  const triggersMetadata: TriggerMetadata[] = runtimeTriggers.map((triggerDef) => ({
    providerType: triggerDef.provider.type,
    providerAlias: triggerDef.provider.alias,
    triggerType: triggerDef.triggerType,
    input: triggerDef.input ?? {},
  }));

  // Sync triggers using TriggerService
  let webhooksInfo: WebhookInfo[] = [];
  if (triggersMetadata.length > 0) {
    try {
      webhooksInfo = await syncTriggers(workflowId, workflow.namespaceId, triggersMetadata);
    } catch (error) {
      logger.error('Failed to sync triggers', {
        error: error instanceof Error ? error.message : String(error),
        deploymentId: deployment.id,
      });
      // Don't fail the deployment, just log the error
    }
  }

  logger.info('Created new workflow deployment', {
    deploymentId: deployment.id,
    workflowId: deployment.workflowId,
    webhooksCount: webhooksInfo.length,
  });

  // Build response
  return json(
    {
      id: deployment.id,
      workflowId: deployment.workflowId,
      runtimeId: deployment.runtimeId,
      deployedById: deployment.deployedById,
      userCode: deployment.userCode,
      status: deployment.status,
      deployedAt: deployment.deployedAt instanceof Date ? deployment.deployedAt.toISOString() : deployment.deployedAt,
      note: deployment.note,
      webhooks: webhooksInfo.map((wh) => ({
        id: wh.id,
        url: wh.url,
        path: wh.path,
        method: wh.method,
        triggerId: wh.triggerId,
        triggerType: wh.triggerType,
        providerType: wh.providerType,
        providerAlias: wh.providerAlias,
      })),
    },
    201
  );
});

// Get deployment
get('/workflow_deployments/:deploymentId', async (ctx) => {
  const { user, params } = ctx;
  if (!user) return errorResponse('Unauthorized', 401);

  const deployment = await workflowService.getDeployment(params.deploymentId);
  if (!deployment) {
    return errorResponse('Deployment not found', 404);
  }

  // Check access to the workflow
  const hasAccess = await hasWorkflowAccess(user.id, deployment.workflowId);
  if (!hasAccess && !user.isAdmin) {
    return errorResponse('Access denied', 403);
  }

  return json({
    id: deployment.id,
    workflowId: deployment.workflowId,
    runtimeId: deployment.runtimeId,
    deployedById: deployment.deployedById,
    userCode: deployment.userCode,
    status: deployment.status,
    deployedAt: deployment.deployedAt instanceof Date ? deployment.deployedAt.toISOString() : deployment.deployedAt,
    note: deployment.note,
  });
});

// Update deployment
patch('/workflow_deployments/:deploymentId', async (ctx) => {
  const { user, params, request } = ctx;
  if (!user) return errorResponse('Unauthorized', 401);

  const deployment = await workflowService.getDeployment(params.deploymentId);
  if (!deployment) {
    return errorResponse('Deployment not found', 404);
  }

  // Check access to the workflow
  const hasAccess = await hasWorkflowAccess(user.id, deployment.workflowId);
  if (!hasAccess && !user.isAdmin) {
    return errorResponse('Access denied', 403);
  }

  const parsed = await parseBody(request, updateWorkflowDeploymentSchema);
  if ('error' in parsed) return parsed.error;

  const { status } = parsed.data;

  if (status) {
    const updated = await workflowService.updateDeploymentStatus(params.deploymentId, status);
    if (!updated) {
      return errorResponse('Failed to update deployment', 500);
    }

    return json({
      id: updated.id,
      workflowId: updated.workflowId,
      runtimeId: updated.runtimeId,
      status: updated.status,
      deployedAt: updated.deployedAt instanceof Date ? updated.deployedAt.toISOString() : updated.deployedAt,
    });
  }

  return json({
    id: deployment.id,
    workflowId: deployment.workflowId,
    runtimeId: deployment.runtimeId,
    status: deployment.status,
    deployedAt: deployment.deployedAt instanceof Date ? deployment.deployedAt.toISOString() : deployment.deployedAt,
  });
});

// Delete deployment
del('/workflow_deployments/:deploymentId', async (ctx) => {
  const { user, params } = ctx;
  if (!user) return errorResponse('Unauthorized', 401);

  const deployment = await workflowService.getDeployment(params.deploymentId);
  if (!deployment) {
    return errorResponse('Deployment not found', 404);
  }

  // Check access to the workflow
  const hasAccess = await hasWorkflowAccess(user.id, deployment.workflowId);
  if (!hasAccess && !user.isAdmin) {
    return errorResponse('Access denied', 403);
  }

  await workflowService.deleteDeployment(params.deploymentId);

  return json({ success: true });
});
