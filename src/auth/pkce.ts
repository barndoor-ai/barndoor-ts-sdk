/**
 * PKCE (Proof Key for Code Exchange) implementation for OAuth 2.0.
 * 
 * This module provides PKCE functionality that mirrors the Python SDK's
 * auth.py implementation, supporting secure OAuth flows in both browser
 * and Node.js environments.
 */

import { OAuthError } from '../exceptions';
import { isBrowser, isNode } from '../config';
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

// Global state for PKCE flow
let _codeVerifier: string | null = null;
let _currentState: string | null = null;

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
    // Fallback for environments without crypto
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }

  return base64URLEncode(array);
}

/**
 * Base64URL encode a Uint8Array.
 * @param buffer - Buffer to encode
 * @returns Base64URL-encoded string
 */
function base64URLEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
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
 * Build authorization URL for OAuth 2.0 with PKCE.
 * @param params - Authorization parameters
 * @returns Authorization URL
 */
export async function buildAuthorizationUrl({
  domain,
  clientId,
  redirectUri,
  audience,
  scope = 'openid profile email'
}: AuthorizationUrlParams): Promise<string> {
  // Generate PKCE parameters
  _codeVerifier = generateRandomString(32);
  const codeChallenge = base64URLEncode(await sha256(_codeVerifier));
  _currentState = generateRandomString(16);

  // Build authorization URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scope,
    audience: audience,
    state: _currentState,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });

  const authUrl = `https://${domain}/authorize?${params.toString()}`;
  return authUrl;
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
 * Exchange authorization code for tokens.
 * @param params - Token exchange parameters
 * @returns Token response
 */
export async function exchangeCodeForToken({
  domain,
  clientId,
  code,
  redirectUri,
  clientSecret
}: TokenExchangeParams): Promise<unknown> {
  const payload: Record<string, string> = {
    grant_type: 'authorization_code',
    client_id: clientId,
    code: code,
    redirect_uri: redirectUri
  };

  // Always add client_secret if provided (like Python SDK)
  if (clientSecret) {
    payload['client_secret'] = clientSecret;
  }

  // Add PKCE verifier if available
  if (_codeVerifier) {
    payload['code_verifier'] = _codeVerifier;
  }

  // Validate we have either client_secret or PKCE verifier
  if (!clientSecret && !_codeVerifier) {
    throw new OAuthError('Either client_secret or PKCE verifier must be provided');
  }
  
  try {
    const response = await fetch(`https://${domain}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: string; error_description?: string };
      // eslint-disable-next-line no-console
      console.error('Token endpoint response:', errorData);
      throw new OAuthError(`Token exchange failed: ${errorData.error ?? errorData.error_description ?? response.statusText}`);
    }

    const tokenData = await response.json();

    // Clear PKCE state after successful exchange
    _codeVerifier = null;
    _currentState = null;

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
 * Start a local callback server for OAuth redirect (Node.js only).
 * @param port - Port to listen on
 * @returns [redirectUri, waiter] tuple
 */
export function startLocalCallbackServer(port = 52765): [string, Promise<[string, string]>] {
  if (!isNode) {
    throw new Error('Local callback server is only available in Node.js environment');
  }

  const redirectUri = `http://localhost:${port}/cb`;

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
                <p>Error: ${error}</p>
                <p>Description: ${error_description || 'Unknown error'}</p>
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
    
    server.listen(port, 'localhost', () => {
      // eslint-disable-next-line no-console
      console.log(`OAuth callback server listening on ${redirectUri}`);
    });

    server.on('error', (error: Error) => {
      reject(new OAuthError(`Failed to start callback server: ${error.message}`));
    });
  });
  
  return [redirectUri, waiter];
}

/**
 * Validate state parameter to prevent CSRF attacks.
 * @param receivedState - State received from OAuth callback
 * @returns True if state is valid
 */
export function validateState(receivedState: string): boolean {
  return Boolean(_currentState && receivedState === _currentState);
}

/**
 * Clear PKCE state (for cleanup or error handling).
 */
export function clearPKCEState(): void {
  _codeVerifier = null;
  _currentState = null;
}
