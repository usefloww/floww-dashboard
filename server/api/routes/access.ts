/**
 * Access Control Routes
 *
 * POST /access/grant - Grant access to resource
 * DELETE /access/revoke - Revoke access
 * GET /access/providers/:providerId/users - List provider access
 * POST /access/providers/:providerId/users - Grant provider access
 * PATCH /access/providers/:providerId/users/:userId - Update role
 * DELETE /access/providers/:providerId/users/:userId - Revoke
 */

import { eq, and } from 'drizzle-orm';
import { get, post, patch, del, json, errorResponse, parseBody } from '~/server/api/router';
import { getDb } from '~/server/db';
import { providerAccess, users } from '~/server/db/schema';
import {
  getResolvedAccess,
  grantAccess,
  revokeAccess,
  type ResourceType,
  type PrincipalType,
  type AccessRole,
} from '~/server/services/access-service';
import { hasProviderAccess } from '~/server/services/provider-service';
import {
  grantAccessSchema,
  grantProviderAccessSchema,
  updateAccessRoleSchema,
} from '~/server/api/schemas';

// Map schema role to service role
function mapToAccessRole(role: string): AccessRole {
  // The service only supports 'owner' | 'user', map 'editor' and 'viewer' to 'user'
  if (role === 'owner') return 'owner';
  return 'user';
}

// Map schema resource type to service resource type
function mapToResourceType(resourceType: string): ResourceType | null {
  if (resourceType === 'workflow' || resourceType === 'folder' || resourceType === 'provider') {
    return resourceType;
  }
  return null;
}

// Map schema principal type to service principal type
function mapToPrincipalType(principalType: string): PrincipalType | null {
  if (principalType === 'user' || principalType === 'workflow' || principalType === 'folder') {
    return principalType;
  }
  return null;
}

// Grant access to a resource
post('/access/grant', async ({ user, request }) => {
  if (!user) return errorResponse('Unauthorized', 401);

  const parsed = await parseBody(request, grantAccessSchema);
  if ('error' in parsed) return parsed.error;

  const { principalType, principalId, resourceType, resourceId, role } = parsed.data;

  const mappedResourceType = mapToResourceType(resourceType);
  if (!mappedResourceType) {
    return errorResponse(`Unsupported resource type: ${resourceType}`, 400);
  }

  const mappedPrincipalType = mapToPrincipalType(principalType);
  if (!mappedPrincipalType) {
    return errorResponse(`Unsupported principal type: ${principalType}`, 400);
  }

  // Verify user has owner access to the resource
  const userRole = await getResolvedAccess('user', user.id, mappedResourceType, resourceId);

  if (userRole !== 'owner' && !user.isAdmin) {
    return errorResponse('You must be an owner of the resource to grant access', 403);
  }

  // Grant access
  await grantAccess(
    mappedPrincipalType,
    principalId,
    mappedResourceType,
    resourceId,
    mapToAccessRole(role)
  );

  return json({ success: true, message: 'Access granted' });
});

// Revoke access from a resource
del('/access/revoke', async ({ user, query }) => {
  if (!user) return errorResponse('Unauthorized', 401);

  const principalType = query.get('principalType');
  const principalId = query.get('principalId');
  const resourceType = query.get('resourceType');
  const resourceId = query.get('resourceId');

  if (!principalType || !principalId || !resourceType || !resourceId) {
    return errorResponse('Missing required parameters', 400);
  }

  const mappedResourceType = mapToResourceType(resourceType);
  if (!mappedResourceType) {
    return errorResponse(`Unsupported resource type: ${resourceType}`, 400);
  }

  const mappedPrincipalType = mapToPrincipalType(principalType);
  if (!mappedPrincipalType) {
    return errorResponse(`Unsupported principal type: ${principalType}`, 400);
  }

  // Verify user has owner access
  const userRole = await getResolvedAccess('user', user.id, mappedResourceType, resourceId);

  if (userRole !== 'owner' && !user.isAdmin) {
    return errorResponse('You must be an owner of the resource to revoke access', 403);
  }

  await revokeAccess(mappedPrincipalType, principalId, mappedResourceType, resourceId);

  return json({ success: true, message: 'Access revoked' });
});

// List users with access to a provider
get('/access/providers/:providerId/users', async ({ user, params }) => {
  if (!user) return errorResponse('Unauthorized', 401);

  const { providerId } = params;

  // Check user can access this provider
  const hasAccess = await hasProviderAccess(user.id, providerId);
  if (!hasAccess && !user.isAdmin) {
    return errorResponse('Provider not found', 404);
  }

  const db = getDb();

  // Get all users with access to this provider
  const accessList = await db
    .select({
      id: providerAccess.id,
      userId: providerAccess.principleId,
      role: providerAccess.role,
      user: {
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      },
    })
    .from(providerAccess)
    .innerJoin(users, eq(providerAccess.principleId, users.id))
    .where(
      and(
        eq(providerAccess.resourceType, 'provider'),
        eq(providerAccess.resourceId, providerId),
        eq(providerAccess.principleType, 'user')
      )
    );

  return json({
    results: accessList.map((a) => ({
      id: a.id,
      userId: a.userId,
      userEmail: a.user.email,
      userFirstName: a.user.firstName,
      userLastName: a.user.lastName,
      role: a.role,
    })),
  });
});

// Grant user access to provider
post('/access/providers/:providerId/users', async ({ user, params, request }) => {
  if (!user) return errorResponse('Unauthorized', 401);

  const { providerId } = params;

  // Verify user has owner access
  const userRole = await getResolvedAccess('user', user.id, 'provider', providerId);
  if (userRole !== 'owner' && !user.isAdmin) {
    return errorResponse('You must be an owner of the provider to grant access', 403);
  }

  const parsed = await parseBody(request, grantProviderAccessSchema);
  if ('error' in parsed) return parsed.error;

  const { userId, role } = parsed.data;

  // Verify target user exists
  const db = getDb();
  const targetUser = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (targetUser.length === 0) {
    return errorResponse('User not found', 404);
  }

  // Grant access
  await grantAccess('user', userId, 'provider', providerId, mapToAccessRole(role));

  return json({
    userId,
    userEmail: targetUser[0].email,
    role,
  }, 201);
});

// Update user's provider access role
patch('/access/providers/:providerId/users/:userId', async ({ user, params, request }) => {
  if (!user) return errorResponse('Unauthorized', 401);

  const { providerId, userId } = params;

  // Verify user has owner access
  const userRole = await getResolvedAccess('user', user.id, 'provider', providerId);
  if (userRole !== 'owner' && !user.isAdmin) {
    return errorResponse('You must be an owner of the provider to update access', 403);
  }

  const parsed = await parseBody(request, updateAccessRoleSchema);
  if ('error' in parsed) return parsed.error;

  const { role } = parsed.data;
  const mappedRole = mapToAccessRole(role);

  const db = getDb();

  // Update the access record
  const result = await db
    .update(providerAccess)
    .set({ role: mappedRole })
    .where(
      and(
        eq(providerAccess.principleType, 'user'),
        eq(providerAccess.principleId, userId),
        eq(providerAccess.resourceType, 'provider'),
        eq(providerAccess.resourceId, providerId)
      )
    )
    .returning();

  if (result.length === 0) {
    return errorResponse('Access grant not found', 404);
  }

  return json({ userId, role });
});

// Revoke user's provider access
del('/access/providers/:providerId/users/:userId', async ({ user, params }) => {
  if (!user) return errorResponse('Unauthorized', 401);

  const { providerId, userId } = params;

  // Verify user has owner access
  const userRole = await getResolvedAccess('user', user.id, 'provider', providerId);
  if (userRole !== 'owner' && !user.isAdmin) {
    return errorResponse('You must be an owner of the provider to revoke access', 403);
  }

  await revokeAccess('user', userId, 'provider', providerId);

  return json({ success: true, message: 'Access revoked' });
});
