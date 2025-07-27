/**
 * Quick-start helpers for the Barndoor SDK.
 * 
 * This module provides convenience functions that remove boilerplate code
 * commonly needed in examples and prototypes, mirroring the Python SDK's
 * quickstart.py functionality.
 */

import { BarndoorSDK } from './client.js';
import { 
  buildAuthorizationUrl, 
  exchangeCodeForToken, 
  startLocalCallbackServer 
} from './auth/index.js';
import { loadUserToken, saveUserToken } from './auth/index.js';
import { getStaticConfig, getDynamicConfig, isNode } from './config.js';
import { ServerNotFoundError } from './exceptions/index.js';

/**
 * Perform interactive login and return an initialized SDK instance.
 * 
 * Opens the system browser for OAuth authentication, waits for the
 * user to complete login, exchanges the authorization code for a JWT,
 * and returns a configured BarndoorSDK instance ready for use.
 * 
 * @param {Object} [options={}] - Login options
 * @param {string} [options.authDomain] - Auth0 domain
 * @param {string} [options.clientId] - OAuth client ID
 * @param {string} [options.clientSecret] - OAuth client secret
 * @param {string} [options.audience] - API audience identifier
 * @param {string} [options.apiBaseUrl] - Base URL of the Barndoor API
 * @param {number} [options.port=52765] - Local port for OAuth callback
 * @returns {Promise<BarndoorSDK>} Initialized SDK instance
 */
export async function loginInteractive(options = {}) {
  if (!isNode) {
    throw new Error('Interactive login is only available in Node.js environment');
  }
  
  console.log('Starting interactive login flow');
  
  const config = getStaticConfig();
  
  const {
    authDomain = config.authDomain,
    clientId = config.clientId,
    clientSecret = config.clientSecret,
    audience = config.apiAudience,
    apiBaseUrl = config.apiBaseUrl,
    port = 52765
  } = options;
  
  if (!clientId || !clientSecret) {
    throw new Error(
      'AGENT_CLIENT_ID / AGENT_CLIENT_SECRET not set – create a .env file or export in the shell'
    );
  }
  
  // 1. Try cached token first
  const cachedToken = await loadUserToken();
  if (cachedToken) {
    try {
      // Try to create SDK with cached token
      const sdk = new BarndoorSDK(apiBaseUrl, { token: cachedToken });
      await sdk.validateCachedToken();
      console.log('Using cached valid token');
      return sdk;
    } catch (error) {
      console.log('Cached token invalid, starting OAuth flow');
    }
  } else {
    console.log('No cached token, starting OAuth flow');
  }
  
  // 2. Start interactive PKCE flow
  const [redirectUri, waiter] = startLocalCallbackServer(port);
  
  const authUrl = await buildAuthorizationUrl({
    domain: authDomain,
    clientId,
    redirectUri,
    audience
  });
  
  // Open browser
  const { exec } = require('child_process');
  const platform = require('os').platform();
  
  let command;
  if (platform === 'darwin') {
    command = `open "${authUrl}"`;
  } else if (platform === 'win32') {
    command = `start "${authUrl}"`;
  } else {
    command = `xdg-open "${authUrl}"`;
  }
  
  exec(command, (error) => {
    if (error) {
      console.warn('Failed to open browser automatically. Please visit:', authUrl);
    } else {
      console.log('Please complete login in your browser…');
    }
  });
  
  // Wait for callback
  const [code, state] = await waiter;
  
  // Exchange code for token
  const tokenData = await exchangeCodeForToken({
    domain: authDomain,
    clientId,
    clientSecret,
    code,
    redirectUri
  });
  
  // Save token and create SDK
  await saveUserToken(tokenData);
  return new BarndoorSDK(apiBaseUrl, { token: tokenData.access_token });
}

/**
 * Ensure a server is connected, initiating OAuth if needed.
 * 
 * Checks if the specified server is already connected. If not,
 * initiates the OAuth flow, opens the browser, and polls until
 * the connection is established.
 * 
 * @param {BarndoorSDK} sdk - SDK instance
 * @param {string} serverIdentifier - Server slug or provider name
 * @param {Object} [options={}] - Options
 * @param {number} [options.timeout=90] - Maximum seconds to wait
 */
export async function ensureServerConnected(sdk, serverIdentifier, options = {}) {
  const { timeout = 90 } = options;
  
  console.log(`Ensuring ${serverIdentifier} server is connected`);
  
  const servers = await sdk.listServers();
  const server = servers.find(s => s.slug === serverIdentifier);
  
  if (!server) {
    console.error(`Server '${serverIdentifier}' not found`);
    throw new ServerNotFoundError(serverIdentifier);
  }
  
  if (server.connection_status === 'connected') {
    console.log(`Server ${serverIdentifier} already connected`);
    return;
  }
  
  console.log(`Connecting to ${serverIdentifier}...`);
  await sdk.ensureServerConnected(serverIdentifier, { pollSeconds: timeout });
}

/**
 * Create MCP connection parameters for a server.
 * 
 * Returns connection parameters that can be used with any MCP client
 * framework (CrewAI, LangChain, custom implementations).
 * 
 * @param {BarndoorSDK} sdk - SDK instance
 * @param {string} serverSlug - Server slug
 * @param {Object} [options={}] - Options
 * @param {string} [options.proxyBaseUrl='http://proxy-ingress:8080'] - Proxy base URL
 * @param {string} [options.transport='streamable-http'] - Transport type
 * @returns {Promise<[Object, string]>} [params, publicUrl]
 */
export async function makeMcpConnectionParams(sdk, serverSlug, options = {}) {
  const {
    proxyBaseUrl = 'http://proxy-ingress:8080',
    transport = 'streamable-http'
  } = options;
  
  // 1. Ensure server exists
  const servers = await sdk.listServers();
  const serverSlugs = new Set(servers.map(s => s.slug));
  
  if (!serverSlugs.has(serverSlug)) {
    throw new ServerNotFoundError(serverSlug, Array.from(serverSlugs));
  }
  
  // 2. Decide proxy vs public based on environment
  const env = (isNode ? process.env.BARNDOOR_ENV || process.env.MODE : '') || 'localdev';
  
  let url;
  if (['localdev', 'local', 'development', 'dev'].includes(env.toLowerCase())) {
    // Use dynamic configuration for local/dev environments
    const dynamicConfig = getDynamicConfig(sdk.token);
    url = `${dynamicConfig.mcpBaseUrl}/mcp/${serverSlug}`;
  } else {
    // Production - use external MCP URL
    url = buildExternalMcpUrl(serverSlug, sdk.token, 'prod');
  }
  
  const params = {
    url: url,
    transport: transport,
    headers: {
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${sdk.token}`,
      'x-barndoor-session-id': generateSessionId()
    }
  };
  
  return [params, url];
}

/**
 * Build external MCP URL for production environments.
 * @private
 */
function buildExternalMcpUrl(serverSlug, jwtToken, env) {
  // This would need to be implemented based on the actual URL structure
  // For now, use a placeholder implementation
  const config = getDynamicConfig(jwtToken);
  return `${config.mcpBaseUrl}/mcp/${serverSlug}`;
}

/**
 * Generate a unique session ID.
 * @private
 */
function generateSessionId() {
  // Generate a UUID v4
  if (isNode) {
    const crypto = require('crypto');
    return crypto.randomUUID();
  } else if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  } else {
    // Fallback UUID generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
