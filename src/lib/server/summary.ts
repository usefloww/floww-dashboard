import { createServerFn } from '@tanstack/react-start';
import { requireUser } from './utils';

export interface SummaryData {
  workflows: {
    total: number;
    active: number;
  };
  executions: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  providers: {
    total: number;
  };
  triggers: {
    total: number;
  };
}

/**
 * Server function to get namespace summary/statistics
 */
export const getSummary = createServerFn({ method: 'GET' })
  .inputValidator((input: { namespaceId: string } | undefined) => {
    if (!input || !input.namespaceId) {
      throw new Error('namespaceId is required');
    }
    return input;
  })
  .handler(async ({ data }): Promise<SummaryData> => {
    if (!data || !data.namespaceId) {
      throw new Error('namespaceId is required');
    }
    
    const user = await requireUser();
    
    // Lazy import to avoid circular dependencies
    const { eq, and, count, gte, inArray } = await import('drizzle-orm');
    const { getDb } = await import('~/server/db');
    const {
      workflows,
      executionHistory,
      providers,
      triggers,
      namespaces,
      organizationMembers,
    } = await import('~/server/db/schema');

    const db = getDb();
    const namespaceId = data.namespaceId;

    // Get organization for this namespace and verify access
    const namespaceResult = await db
      .select({ organizationOwnerId: namespaces.organizationOwnerId })
      .from(namespaces)
      .where(eq(namespaces.id, namespaceId))
      .limit(1);

    if (namespaceResult.length === 0) {
      return {
        workflows: { total: 0, active: 0 },
        executions: { total: 0, today: 0, thisWeek: 0, thisMonth: 0 },
        providers: { total: 0 },
        triggers: { total: 0 },
      };
    }

    const organizationId = namespaceResult[0].organizationOwnerId;

    if (!organizationId) {
      return {
        workflows: { total: 0, active: 0 },
        executions: { total: 0, today: 0, thisWeek: 0, thisMonth: 0 },
        providers: { total: 0 },
        triggers: { total: 0 },
      };
    }

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

    if (membership.length === 0) {
      throw new Error('Access denied');
    }

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
        .where(inArray(executionHistory.workflowId, wfIds));

      // Today's executions
      const todayExec = await db
        .select({ count: count() })
        .from(executionHistory)
        .where(
          and(
            inArray(executionHistory.workflowId, wfIds),
            gte(executionHistory.startedAt, startOfDay)
          )
        );

      // This week's executions
      const weekExec = await db
        .select({ count: count() })
        .from(executionHistory)
        .where(
          and(
            inArray(executionHistory.workflowId, wfIds),
            gte(executionHistory.startedAt, startOfWeek)
          )
        );

      // This month's executions
      const monthExec = await db
        .select({ count: count() })
        .from(executionHistory)
        .where(
          and(
            inArray(executionHistory.workflowId, wfIds),
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

    return {
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
    };
  });
