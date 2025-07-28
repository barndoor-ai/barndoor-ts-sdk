/**
 * PKCE (Proof Key for Code Exchange) implementation for OAuth 2.0.
 * 
 * This module provides PKCE functionality that mirrors the Python SDK's
 * auth.py implementation, supporting secure OAuth flows in both browser
 * and Node.js environments.
 */

import { OAuthError } from '../exceptions/index.js';
import { isBrowser, isNode } from '../config.js';
import crypto from 'crypto';
import http from 'http';
import url from 'url';

// Global state for PKCE flow
let _codeVerifier = null;
let _currentState = null;

/**
 * Generate a cryptographically secure random string.
 * @param {number} length - Length of the random string
 * @returns {string} Base64URL-encoded random string
 */
function generateRandomString(length) {
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
 * @param {Uint8Array} buffer - Buffer to encode
 * @returns {string} Base64URL-encoded string
 */
function base64URLEncode(buffer) {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Generate SHA256 hash of a string.
 * @param {string} str - String to hash
 * @returns {Promise<Uint8Array>} SHA256 hash
 */
async function sha256(str) {
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
 * Build authorization URL for OAuth 2.0 with PKCE.
 * @param {Object} params - Authorization parameters
 * @param {string} params.domain - Auth0 domain
 * @param {string} params.clientId - OAuth client ID
 * @param {string} params.redirectUri - Redirect URI
 * @param {string} params.audience - API audience
 * @param {string} [params.scope='openid profile email'] - OAuth scopes
 * @returns {Promise<string>} Authorization URL
 */
export async function buildAuthorizationUrl({
  domain,
  clientId,
  redirectUri,
  audience,
  scope = 'openid profile email'
}) {
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
 * Exchange authorization code for tokens.
 * @param {Object} params - Token exchange parameters
 * @param {string} params.domain - Auth0 domain
 * @param {string} params.clientId - OAuth client ID
 * @param {string} params.code - Authorization code
 * @param {string} params.redirectUri - Redirect URI
 * @param {string} [params.clientSecret] - Client secret (for backend flows)
 * @returns {Promise<Object>} Token response
 */
export async function exchangeCodeForToken({
  domain,
  clientId,
  code,
  redirectUri,
  clientSecret = null
}) {
  const payload = {
    grant_type: 'authorization_code',
    client_id: clientId,
    code: code,
    redirect_uri: redirectUri
  };
  
  // Always add client_secret if provided (like Python SDK)
  if (clientSecret) {
    payload.client_secret = clientSecret;
  }
  
  // Add PKCE verifier if available
  if (_codeVerifier) {
    payload.code_verifier = _codeVerifier;
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
      const errorData = await response.json().catch(() => ({}));
      console.error('Token endpoint response:', errorData);
      throw new OAuthError(`Token exchange failed: ${errorData.error || errorData.error_description || response.statusText}`);
    }
    
    const tokenData = await response.json();
    
    // Clear PKCE state after successful exchange
    _codeVerifier = null;
    _currentState = null;
    
    return tokenData;
  } catch (error) {
    if (error instanceof OAuthError) {
      throw error;
    }
    throw new OAuthError(`Token exchange failed: ${error.message}`);
  }
}

/**
 * Start a local callback server for OAuth redirect (Node.js only).
 * @param {number} [port=52765] - Port to listen on
 * @returns {Promise<[string, Promise<[string, string]>]>} [redirectUri, waiter]
 */
export function startLocalCallbackServer(port = 52765) {
  if (!isNode) {
    throw new Error('Local callback server is only available in Node.js environment');
  }
  

  
  const redirectUri = `http://localhost:${port}/cb`;
  
  const waiter = new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url, true);
      
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
          resolve([code, state]);
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
      console.log(`OAuth callback server listening on ${redirectUri}`);
    });
    
    server.on('error', (error) => {
      reject(new OAuthError(`Failed to start callback server: ${error.message}`));
    });
  });
  
  return [redirectUri, waiter];
}

/**
 * Validate state parameter to prevent CSRF attacks.
 * @param {string} receivedState - State received from OAuth callback
 * @returns {boolean} True if state is valid
 */
export function validateState(receivedState) {
  return _currentState && receivedState === _currentState;
}

/**
 * Clear PKCE state (for cleanup or error handling).
 */
export function clearPKCEState() {
  _codeVerifier = null;
  _currentState = null;
}
