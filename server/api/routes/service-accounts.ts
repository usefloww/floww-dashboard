/**
 * Service Accounts Routes
 *
 * Service accounts are users with userType = 'service_account'.
 * API keys are associated with users (service accounts).
 *
 * GET /service_accounts - List service accounts for organization
 * POST /service_accounts - Create service account
 * GET /service_accounts/:id - Get service account details
 * DELETE /service_accounts/:id - Delete service account
 * POST /service_accounts/:id/api_keys - Create API key
 * POST /service_accounts/:id/api_keys/:keyId/revoke - Revoke API key
 */

import { eq, and, isNull } from 'drizzle-orm';
import { get, post, del, json, errorResponse, parseBody } from '~/server/api/router';
import { getDb } from '~/server/db';
import { users, apiKeys, organizationMembers } from '~/server/db/schema';
import { generateUlidUuid } from '~/server/utils/uuid';
import { generateApiKey, hashApiKey } from '~/server/utils/encryption';
import { createServiceAccountSchema, createApiKeySchema } from '~/server/api/schemas';

// List service accounts for an organization
get('/service_accounts', async ({ user, query }) => {
  if (!user) return errorResponse('Unauthorized', 401);

  const organizationId = query.get('organizationId');
  if (!organizationId) {
    return errorResponse('organizationId query parameter is required', 400);
  }

  const db = getDb();

  // Verify user has access to the organization
  const membership = await db
    .select()
    .from(organizationMembers)
    .where(
      and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, user.id))
    )
    .limit(1);

  if (membership.length === 0 && !user.isAdmin) {
    return errorResponse('Access denied', 403);
  }

  // Get service accounts (users with userType 'service_account') that are members of this org
  const serviceAccountMembers = await db
    .select({
      id: users.id,
      username: users.username,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(organizationMembers, eq(organizationMembers.userId, users.id))
    .where(
      and(
        eq(users.userType, 'service_account'),
        eq(organizationMembers.organizationId, organizationId)
      )
    );

  // For each service account, get its API keys
  const results = await Promise.all(
    serviceAccountMembers.map(async (sa) => {
      const keys = await db
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          prefix: apiKeys.prefix,
          createdAt: apiKeys.createdAt,
          lastUsedAt: apiKeys.lastUsedAt,
          revokedAt: apiKeys.revokedAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.userId, sa.id));

      return {
        id: sa.id,
        name: sa.username || 'Unnamed Service Account',
        organizationId,
        apiKeys: keys.map((k) => ({
          id: k.id,
          name: k.name,
          prefix: k.prefix,
          createdAt: k.createdAt?.toISOString(),
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          revokedAt: k.revokedAt?.toISOString() ?? null,
        })),
      };
    })
  );

  return json({ results });
});

// Create service account
post('/service_accounts', async ({ user, request }) => {
  if (!user) return errorResponse('Unauthorized', 401);

  const parsed = await parseBody(request, createServiceAccountSchema);
  if ('error' in parsed) return parsed.error;

  const { organizationId, name } = parsed.data;
  const db = getDb();

  // Verify user has access to the organization
  const membership = await db
    .select()
    .from(organizationMembers)
    .where(
      and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, user.id))
    )
    .limit(1);

  if (membership.length === 0 && !user.isAdmin) {
    return errorResponse('Access denied', 403);
  }

  // Create service account user
  const saId = generateUlidUuid();
  const result = await db
    .insert(users)
    .values({
      id: saId,
      userType: 'service_account',
      username: name,
    })
    .returning();

  const serviceAccount = result[0];

  // Add service account to organization
  await db.insert(organizationMembers).values({
    id: generateUlidUuid(),
    organizationId,
    userId: saId,
    role: 'member',
  });

  return json(
    {
      id: serviceAccount.id,
      name: serviceAccount.username,
      organizationId,
      apiKeys: [],
    },
    201
  );
});

// Get service account details
get('/service_accounts/:id', async ({ user, params }) => {
  if (!user) return errorResponse('Unauthorized', 401);

  const db = getDb();

  // Get service account with org membership
  const results = await db
    .select({
      id: users.id,
      username: users.username,
      createdAt: users.createdAt,
      organizationId: organizationMembers.organizationId,
    })
    .from(users)
    .innerJoin(organizationMembers, eq(organizationMembers.userId, users.id))
    .where(and(eq(users.id, params.id), eq(users.userType, 'service_account')))
    .limit(1);

  if (results.length === 0) {
    return errorResponse('Service account not found', 404);
  }

  const sa = results[0];

  // Verify user has access to this org
  const membership = await db
    .select()
    .from(organizationMembers)
    .where(
      and(eq(organizationMembers.organizationId, sa.organizationId), eq(organizationMembers.userId, user.id))
    )
    .limit(1);

  if (membership.length === 0 && !user.isAdmin) {
    return errorResponse('Access denied', 403);
  }

  // Get API keys
  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, sa.id));

  return json({
    id: sa.id,
    name: sa.username || 'Unnamed Service Account',
    organizationId: sa.organizationId,
    apiKeys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      createdAt: k.createdAt?.toISOString(),
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      revokedAt: k.revokedAt?.toISOString() ?? null,
    })),
  });
});

// Delete service account
del('/service_accounts/:id', async ({ user, params }) => {
  if (!user) return errorResponse('Unauthorized', 401);

  const db = getDb();

  // Verify it's a service account and get org
  const results = await db
    .select({
      id: users.id,
      organizationId: organizationMembers.organizationId,
    })
    .from(users)
    .innerJoin(organizationMembers, eq(organizationMembers.userId, users.id))
    .where(and(eq(users.id, params.id), eq(users.userType, 'service_account')))
    .limit(1);

  if (results.length === 0) {
    return errorResponse('Service account not found', 404);
  }

  const sa = results[0];

  // Verify user has access to this org
  const membership = await db
    .select()
    .from(organizationMembers)
    .where(
      and(eq(organizationMembers.organizationId, sa.organizationId), eq(organizationMembers.userId, user.id))
    )
    .limit(1);

  if (membership.length === 0 && !user.isAdmin) {
    return errorResponse('Access denied', 403);
  }

  // Delete the user (cascades to API keys and org membership)
  await db.delete(users).where(eq(users.id, params.id));

  return json({ success: true });
});

// Create API key for service account
post('/service_accounts/:id/api_keys', async ({ user, params, request }) => {
  if (!user) return errorResponse('Unauthorized', 401);

  const parsed = await parseBody(request, createApiKeySchema);
  if ('error' in parsed) return parsed.error;

  const { name } = parsed.data;
  const db = getDb();

  // Verify it's a service account and get org
  const results = await db
    .select({
      id: users.id,
      organizationId: organizationMembers.organizationId,
    })
    .from(users)
    .innerJoin(organizationMembers, eq(organizationMembers.userId, users.id))
    .where(and(eq(users.id, params.id), eq(users.userType, 'service_account')))
    .limit(1);

  if (results.length === 0) {
    return errorResponse('Service account not found', 404);
  }

  const sa = results[0];

  // Verify user has access to this org
  const membership = await db
    .select()
    .from(organizationMembers)
    .where(
      and(eq(organizationMembers.organizationId, sa.organizationId), eq(organizationMembers.userId, user.id))
    )
    .limit(1);

  if (membership.length === 0 && !user.isAdmin) {
    return errorResponse('Access denied', 403);
  }

  // Generate API key
  const [plaintext, prefix] = generateApiKey();
  const hash = hashApiKey(plaintext);

  const result = await db
    .insert(apiKeys)
    .values({
      name,
      prefix,
      hashedKey: hash,
      userId: params.id,
    })
    .returning();

  const key = result[0];

  return json(
    {
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      apiKey: plaintext, // Only returned once!
      createdAt: key.createdAt?.toISOString(),
    },
    201
  );
});

// Revoke API key
post('/service_accounts/:id/api_keys/:keyId/revoke', async ({ user, params }) => {
  if (!user) return errorResponse('Unauthorized', 401);

  const db = getDb();

  // Verify it's a service account and get org
  const results = await db
    .select({
      id: users.id,
      organizationId: organizationMembers.organizationId,
    })
    .from(users)
    .innerJoin(organizationMembers, eq(organizationMembers.userId, users.id))
    .where(and(eq(users.id, params.id), eq(users.userType, 'service_account')))
    .limit(1);

  if (results.length === 0) {
    return errorResponse('Service account not found', 404);
  }

  const sa = results[0];

  // Verify user has access to this org
  const membership = await db
    .select()
    .from(organizationMembers)
    .where(
      and(eq(organizationMembers.organizationId, sa.organizationId), eq(organizationMembers.userId, user.id))
    )
    .limit(1);

  if (membership.length === 0 && !user.isAdmin) {
    return errorResponse('Access denied', 403);
  }

  // Verify key belongs to this service account and is not already revoked
  const keyResult = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, params.keyId), eq(apiKeys.userId, params.id), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (keyResult.length === 0) {
    return errorResponse('API key not found or already revoked', 404);
  }

  // Revoke the key
  await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, params.keyId));

  return json({ success: true });
});
