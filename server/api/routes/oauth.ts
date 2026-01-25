/**
 * OAuth Routes
 *
 * GET /oauth/:providerName/authorize - Start OAuth flow
 * GET /oauth/:providerName/callback - Handle OAuth callback
 */

import { get, json, errorResponse } from '~/server/api/router';
import { getOAuthProvider } from '~/server/services/oauth-service';
import { getProvider, updateProvider } from '~/server/services/provider-service';
import { logger } from '~/server/utils/logger';

// Start OAuth authorization flow
get('/oauth/:providerName/authorize', async ({ user, params, query, request }) => {
  if (!user) return errorResponse('Unauthorized', 401);

  const { providerName } = params;
  const providerId = query.get('providerId');
  const redirectUri = query.get('redirectUri');

  if (!providerId) {
    return errorResponse('providerId is required', 400);
  }

  // Get OAuth provider implementation
  const oauthProvider = getOAuthProvider(providerName);
  if (!oauthProvider) {
    return errorResponse(`Unknown OAuth provider: ${providerName}`, 400);
  }

  // Generate state parameter with provider ID
  const state = Buffer.from(
    JSON.stringify({
      providerId,
      userId: user.id,
      timestamp: Date.now(),
    })
  ).toString('base64url');

  // Build redirect URI
  const host = request.headers.get('host') ?? 'localhost:3000';
  const scheme = host.includes('localhost') ? 'http' : 'https';
  const callbackUri =
    redirectUri ?? `${scheme}://${host}/api/oauth/${providerName}/callback`;

  // Get authorization URL - default scopes for now
  const scopes: string[] = [];
  const authUrl = oauthProvider.getAuthorizationUrl(scopes, state, callbackUri);

  return Response.redirect(authUrl, 302);
});

// Handle OAuth callback
get('/oauth/:providerName/callback', async ({ params, query }) => {
  const { providerName } = params;
  const code = query.get('code');
  const state = query.get('state');
  const error = query.get('error');

  if (error) {
    return json({ error, errorDescription: query.get('error_description') }, 400);
  }

  if (!code || !state) {
    return errorResponse('Missing code or state parameter', 400);
  }

  // Decode state
  let stateData: { providerId: string; userId: string; timestamp: number };
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
  } catch {
    return errorResponse('Invalid state parameter', 400);
  }

  // Validate state timestamp (15 minute expiry)
  if (Date.now() - stateData.timestamp > 15 * 60 * 1000) {
    return errorResponse('State expired', 400);
  }

  // Get OAuth provider implementation
  const oauthProvider = getOAuthProvider(providerName);
  if (!oauthProvider) {
    return errorResponse(`Unknown OAuth provider: ${providerName}`, 400);
  }

  try {
    // Build redirect URI for token exchange
    const host = query.get('host') ?? 'localhost:3000';
    const scheme = host.includes('localhost') ? 'http' : 'https';
    const redirectUri = `${scheme}://${host}/api/oauth/${providerName}/callback`;

    // Exchange code for tokens
    const tokens = await oauthProvider.exchangeCode(code, redirectUri);

    // Get the provider record
    const provider = await getProvider(stateData.providerId);
    if (!provider) {
      return errorResponse('Provider not found', 404);
    }

    // Update provider with tokens
    const config = {
      ...provider.config,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt?.toISOString(),
      scope: tokens.scope,
    };

    await updateProvider(stateData.providerId, { config });

    // Redirect to success page
    return Response.redirect('/settings/providers?oauth=success', 302);
  } catch (err) {
    logger.error('OAuth callback error', { error: err instanceof Error ? err.message : String(err) });
    return Response.redirect(
      `/settings/providers?oauth=error&message=${encodeURIComponent(
        err instanceof Error ? err.message : 'Unknown error'
      )}`,
      302
    );
  }
});
