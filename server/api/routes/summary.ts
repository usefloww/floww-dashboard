/**
 * Summary Routes
 *
 * GET /summary - Organization statistics/analytics
 */

import { eq, and, count, gte } from 'drizzle-orm';
import { get, json, errorResponse } from '~/server/api/router';
import { getDb } from '~/server/db';
import {
  workflows,
  executionHistory,
  providers,
  triggers,
  namespaces,
  organizationMembers,
} from '~/server/db/schema';

// Get organization summary/statistics
get('/summary', async ({ user, query }) => {
  if (!user) return errorResponse('Unauthorized', 401);

  const organizationId = query.get('organizationId');
  if (!organizationId) {
    return errorResponse('organizationId is required', 400);
  }

  const db = getDb();

  // Verify user is member of organization
  const membership = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, user.id)
      )
    )
    .limit(1);

  if (membership.length === 0 && !user.isAdmin) {
    return errorResponse('Access denied', 403);
  }

  // Get namespace for this organization
  const namespaceResult = await db
    .select({ id: namespaces.id })
    .from(namespaces)
    .where(eq(namespaces.organizationOwnerId, organizationId))
    .limit(1);

  if (namespaceResult.length === 0) {
    return json({
      workflows: { total: 0, active: 0 },
      executions: { total: 0, today: 0, thisWeek: 0, thisMonth: 0 },
      providers: { total: 0 },
      triggers: { total: 0 },
    });
  }

  const namespaceId = namespaceResult[0].id;

  // Count workflows
  const workflowStats = await db
    .select({
      total: count(),
    })
    .from(workflows)
    .where(eq(workflows.namespaceId, namespaceId));

  const activeWorkflows = await db
    .select({ count: count() })
    .from(workflows)
    .where(and(eq(workflows.namespaceId, namespaceId), eq(workflows.active, true)));

  // Count executions
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const workflowIds = await db
    .select({ id: workflows.id })
    .from(workflows)
    .where(eq(workflows.namespaceId, namespaceId));

  const wfIds = workflowIds.map((w) => w.id);

  let executionStats = { total: 0, today: 0, thisWeek: 0, thisMonth: 0 };

  if (wfIds.length > 0) {
    // Total executions
    const totalExec = await db
      .select({ count: count() })
      .from(executionHistory)
      .where(eq(executionHistory.workflowId, wfIds[0])); // Simplified for now

    // Today's executions
    const todayExec = await db
      .select({ count: count() })
      .from(executionHistory)
      .where(
        and(eq(executionHistory.workflowId, wfIds[0]), gte(executionHistory.startedAt, startOfDay))
      );

    // This week's executions
    const weekExec = await db
      .select({ count: count() })
      .from(executionHistory)
      .where(
        and(eq(executionHistory.workflowId, wfIds[0]), gte(executionHistory.startedAt, startOfWeek))
      );

    // This month's executions
    const monthExec = await db
      .select({ count: count() })
      .from(executionHistory)
      .where(
        and(
          eq(executionHistory.workflowId, wfIds[0]),
          gte(executionHistory.startedAt, startOfMonth)
        )
      );

    executionStats = {
      total: totalExec[0]?.count ?? 0,
      today: todayExec[0]?.count ?? 0,
      thisWeek: weekExec[0]?.count ?? 0,
      thisMonth: monthExec[0]?.count ?? 0,
    };
  }

  // Count providers
  const providerStats = await db
    .select({ count: count() })
    .from(providers)
    .where(eq(providers.namespaceId, namespaceId));

  // Count triggers
  const triggerStats = await db
    .select({ count: count() })
    .from(triggers)
    .innerJoin(workflows, eq(triggers.workflowId, workflows.id))
    .where(eq(workflows.namespaceId, namespaceId));

  return json({
    workflows: {
      total: workflowStats[0]?.total ?? 0,
      active: activeWorkflows[0]?.count ?? 0,
    },
    executions: executionStats,
    providers: {
      total: providerStats[0]?.count ?? 0,
    },
    triggers: {
      total: triggerStats[0]?.count ?? 0,
    },
  });
});
