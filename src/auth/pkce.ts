/**
 * PKCE (Proof Key for Code Exchange) implementation for OAuth 2.0.
 *
 * This module provides PKCE functionality that mirrors the Python SDK's
 * auth.py implementation, supporting secure OAuth flows in both browser
 * and Node.js environments.
 */

import { OAuthError } from '../exceptions';
import { isBrowser, isNode } from '../config';
import { createScopedLogger } from '../logging';
import crypto from 'crypto';
import http from 'http';
import url from 'url';

/**
 * PKCE state data structure.
 */
export interface PKCEState {
  /** Code verifier for PKCE flow */
  codeVerifier: string;
  /** Code challenge derived from verifier */
  codeChallenge: string;
  /** OAuth state parameter */
  state: string;
  /** Timestamp when state was created */
  timestamp: number;
}

/**
 * PKCE Manager class to handle state per instance instead of globally.
 * This prevents race conditions in browser environments with multiple parallel login flows.
 */
export class PKCEManager {
  private _codeVerifier: string | null = null;
  private _currentState: string | null = null;
  private readonly _logger = createScopedLogger('pkce');

  /**
   * Generate PKCE parameters and build authorization URL.
   * @param params - Authorization parameters
   * @returns Authorization URL
   */
  public async buildAuthorizationUrl({
    domain,
    clientId,
    redirectUri,
    audience,
    scope = 'openid profile email',
  }: AuthorizationUrlParams): Promise<string> {
    // Generate PKCE parameters
    this._codeVerifier = generateRandomString(32);
    const codeChallenge = base64URLEncode(await sha256(this._codeVerifier));
    this._currentState = generateRandomString(16);

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      audience,
      state: this._currentState,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `https://${domain}/authorize?${params.toString()}`;
    return authUrl;
  }

  /**
   * Exchange authorization code for tokens using stored PKCE state.
   * @param params - Token exchange parameters
   * @returns Token response
   */
  public async exchangeCodeForToken({
    domain,
    clientId,
    code,
    redirectUri,
    clientSecret,
  }: TokenExchangeParams): Promise<unknown> {
    const payload: Record<string, string> = {
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
    };

    // Always add client_secret if provided (like Python SDK)
    if (clientSecret) {
      payload['client_secret'] = clientSecret;
    }

    // Add PKCE verifier if available
    if (this._codeVerifier) {
      payload['code_verifier'] = this._codeVerifier;
    }

    // Validate we have either client_secret or PKCE verifier
    if (!clientSecret && !this._codeVerifier) {
      throw new OAuthError('Either client_secret or PKCE verifier must be provided');
    }

    try {
      const response = await fetch(`https://${domain}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          error?: string;
          error_description?: string;
        };
        this._logger.error('Token endpoint response:', errorData);
        throw new OAuthError(
          `Token exchange failed: ${errorData.error ?? errorData.error_description ?? response.statusText}`
        );
      }

      const tokenData = await response.json();

      // Clear PKCE state after successful exchange
      this.clearState();

      return tokenData;
    } catch (error: unknown) {
      if (error instanceof OAuthError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new OAuthError(`Token exchange failed: ${errorMessage}`);
    }
  }

  /**
   * Validate state parameter to prevent CSRF attacks.
   * @param receivedState - State received from OAuth callback
   * @returns True if state is valid
   */
  public validateState(receivedState: string): boolean {
    return Boolean(this._currentState && receivedState === this._currentState);
  }

  /**
   * Clear PKCE state (for cleanup or error handling).
   */
  public clearState(): void {
    this._codeVerifier = null;
    this._currentState = null;
  }

  /**
   * Get current PKCE state (for debugging/testing).
   */
  public getState(): PKCEState | null {
    if (!this._codeVerifier || !this._currentState) {
      return null;
    }
    return {
      codeVerifier: this._codeVerifier,
      codeChallenge: '', // We don't store this, would need to recalculate
      state: this._currentState,
      timestamp: Date.now(),
    };
  }
}

/**
 * Generate a cryptographically secure random string.
 * @param length - Length of the random string
 * @returns Base64URL-encoded random string
 */
function generateRandomString(length: number): string {
  const array = new Uint8Array(length);

  if (isBrowser && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(array);
  } else if (isNode) {
    crypto.randomFillSync(array);
  } else {
    // Fail closed in environments without secure crypto
    throw new Error('Secure random generator not available for PKCE.');
  }

  return base64URLEncode(array);
}

/**
 * Cross-platform base64 encode function.
 * @param buffer - Buffer to encode
 * @returns Base64-encoded string
 */
function base64Encode(buffer: Uint8Array): string {
  if (typeof globalThis !== 'undefined' && globalThis.btoa) {
    return globalThis.btoa(String.fromCharCode(...buffer));
  } else if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  } else {
    throw new Error('No base64 encode function available');
  }
}

/**
 * Base64URL encode a Uint8Array.
 * @param buffer - Buffer to encode
 * @returns Base64URL-encoded string
 */
function base64URLEncode(buffer: Uint8Array): string {
  const base64 = base64Encode(buffer);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Generate SHA256 hash of a string.
 * @param str - String to hash
 * @returns SHA256 hash
 */
async function sha256(str: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);

  if (isBrowser && window.crypto && window.crypto.subtle) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hashBuffer);
  } else if (isNode) {
    const hash = crypto.createHash('sha256').update(str).digest();
    return new Uint8Array(hash);
  } else {
    throw new Error('SHA256 not available in this environment');
  }
}

/**
 * Authorization URL parameters.
 */
export interface AuthorizationUrlParams {
  /** Auth0 domain */
  domain: string;
  /** OAuth client ID */
  clientId: string;
  /** Redirect URI */
  redirectUri: string;
  /** API audience */
  audience: string;
  /** OAuth scopes */
  scope?: string;
}

/**
 * Token exchange parameters.
 */
export interface TokenExchangeParams {
  /** Auth0 domain */
  domain: string;
  /** OAuth client ID */
  clientId: string;
  /** Authorization code */
  code: string;
  /** Redirect URI */
  redirectUri: string;
  /** Client secret (for backend flows) */
  clientSecret?: string;
}

/**
 * Start a local callback server for OAuth redirect (Node.js only).
 * @param port - Port to listen on
 * @returns [redirectUri, waiter] tuple
 */
export function startLocalCallbackServer(port = 52765): [string, Promise<[string, string]>] {
  if (!isNode) {
    throw new Error('Local callback server is only available in Node.js environment');
  }

  // Allow override of redirect host for environments with strict callback allowlists
  const redirectHost =
    (typeof process !== 'undefined' && process.env && process.env['BARNDOOR_REDIRECT_HOST']) ||
    'localhost';
  const redirectUri = `http://${redirectHost}:${port}/cb`;

  const waiter = new Promise<[string, string]>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url ?? '', true);

      if (parsedUrl.pathname === '/cb') {
        const { code, state, error, error_description } = parsedUrl.query;

        // Send response to browser
        res.writeHead(200, { 'Content-Type': 'text/html' });
        if (error) {
          res.end(`
            <html>
              <body>
                <h1>Authentication Failed</h1>
                <p>Error: Authentication error occurred.</p>
                <p>Description: Please return to the application for details.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new OAuthError(`OAuth error: ${error} - ${error_description}`));
        } else if (code) {
          res.end(`
            <html>
              <body>
                <h1>Authentication Successful</h1>
                <p>You can close this window and return to your application.</p>
              </body>
            </html>
          `);
          server.close();
          resolve([code as string, state as string]);
        } else {
          res.end(`
            <html>
              <body>
                <h1>Authentication Failed</h1>
                <p>No authorization code received.</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new OAuthError('No authorization code received'));
        }
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    // Bind to all interfaces and let OS handle IPv4/IPv6; avoids ::1 vs 127.0.0.1 mismatch
    server.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`OAuth callback server listening on ${redirectUri}`);
    });

    server.on('error', (error: Error) => {
      reject(new OAuthError(`Failed to start callback server: ${error.message}`));
    });
  });

  return [redirectUri, waiter];
}
