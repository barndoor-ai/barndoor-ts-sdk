/**
 * OAuth 2.0 client-credentials (machine-to-machine) grant support.
 *
 * Mirrors the Python SDK's `get_client_credentials_token` /
 * `get_client_credentials_token_async` helpers (PR #78).
 */

import { OAuthError } from '../exceptions';
import { getOidcConfig } from './store';
import { createScopedLogger } from '../logging';

const _logger = createScopedLogger('client-credentials');

/**
 * Parameters for the client-credentials grant.
 */
export interface ClientCredentialsParams {
  /** OAuth client ID for a Barndoor M2M application. */
  clientId: string;
  /** OAuth client secret. */
  clientSecret: string;
  /** API audience identifier (e.g., `https://barndoor.ai/`). */
  audience: string;
  /**
   * OIDC issuer URL. Preferred over `domain`; OIDC discovery is used to
   * locate the token endpoint.
   */
  issuer?: string;
  /**
   * Legacy auth domain (POSTs directly to `https://{domain}/oauth/token`).
   * Provide either `issuer` or `domain`.
   */
  domain?: string;
  /** Request timeout in milliseconds (default: 15000). */
  timeoutMs?: number;
}

/**
 * Resolve the token endpoint and form body for a client-credentials grant.
 * @internal
 */
export async function _resolveClientCredentialsRequest(
  params: ClientCredentialsParams
): Promise<{ tokenEndpoint: string; body: URLSearchParams }> {
  const { clientId, clientSecret, audience, issuer, domain } = params;

  let tokenEndpoint: string;
  if (issuer) {
    const oidcConfig = await getOidcConfig(issuer);
    tokenEndpoint = oidcConfig.token_endpoint;
  } else if (domain) {
    tokenEndpoint = `https://${domain}/oauth/token`;
  } else {
    throw new OAuthError("Either 'issuer' or 'domain' must be provided");
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    audience,
  });

  return { tokenEndpoint, body };
}

/**
 * Perform the OAuth 2.0 client-credentials grant against the auth server
 * and return the issued access token.
 *
 * Suitable for headless / machine-to-machine use cases where no interactive
 * user is available. The token is returned directly without caching; for
 * a ready-to-use SDK instance with automatic refresh, prefer
 * {@link BarndoorSDK.fromClientCredentials}.
 *
 * @example
 * ```ts
 * const token = await getClientCredentialsToken({
 *   clientId: process.env.BARNDOOR_M2M_CLIENT_ID!,
 *   clientSecret: process.env.BARNDOOR_M2M_CLIENT_SECRET!,
 *   audience: 'https://barndoor.ai/',
 *   issuer: 'https://auth.barndoor.ai/realms/barndoor',
 * });
 * ```
 */
export async function getClientCredentialsToken(params: ClientCredentialsParams): Promise<string> {
  const { timeoutMs = 15000 } = params;
  const { tokenEndpoint, body } = await _resolveClientCredentialsRequest(params);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        error?: string;
        error_description?: string;
      };
      _logger.error('Client-credentials token endpoint error:', errorData);
      throw new OAuthError(
        `Client-credentials grant failed: ${
          errorData.error_description ?? errorData.error ?? response.statusText
        }`
      );
    }

    const tokenData = (await response.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      throw new OAuthError('Client-credentials grant: response missing access_token');
    }
    return tokenData.access_token;
  } catch (error: unknown) {
    if (error instanceof OAuthError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new OAuthError(`Client-credentials grant timed out after ${timeoutMs}ms`);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new OAuthError(`Client-credentials grant failed: ${message}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Return true if the given JWT's `exp` claim is within `skewSeconds` of now.
 *
 * Tokens that cannot be parsed or have no `exp` claim are treated as
 * already expired so callers err on the side of refreshing.
 *
 * @internal
 */
export function _tokenNearExpiry(token: string, skewSeconds: number): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return true;
  }
  const payloadPart = parts[1];
  if (!payloadPart) {
    return true;
  }
  let payload: { exp?: unknown };
  try {
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const decoded =
      typeof Buffer !== 'undefined'
        ? Buffer.from(base64, 'base64').toString('utf8')
        : globalThis.atob(base64);
    payload = JSON.parse(decoded) as { exp?: unknown };
  } catch {
    return true;
  }
  const exp = payload.exp;
  if (typeof exp !== 'number') {
    return true;
  }
  return exp - Date.now() / 1000 <= skewSeconds;
}
