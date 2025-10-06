/**
 * Quick-start helpers for the Barndoor SDK.
 *
 * This module provides convenience functions that remove boilerplate code
 * commonly needed in examples and prototypes, mirroring the Python SDK's
 * quickstart.py functionality.
 */

import { BarndoorSDK } from './client';
import { PKCEManager, startLocalCallbackServer } from './auth';
import { loadUserToken, saveUserToken } from './auth';
import { getStaticConfig, getDynamicConfig, hasOrganizationInfo, isNode } from './config';
import { ServerNotFoundError } from './exceptions';
import { createScopedLogger } from './logging';
import { spawn } from 'child_process';
import os from 'os';
import crypto from 'crypto';
import readline from 'readline';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// Create scoped logger for quickstart functions
const logger = createScopedLogger('quickstart');

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
/**
 * Login options interface.
 */
export interface LoginInteractiveOptions {
  /** Auth0 domain */
  authDomain?: string;
  /** OAuth client ID */
  clientId?: string;
  /** OAuth client secret */
  clientSecret?: string;
  /** API audience identifier */
  audience?: string;
  /** Base URL of the Barndoor API */
  apiBaseUrl?: string;
  /** Local port for OAuth callback */
  port?: number;
}

export async function loginInteractive(
  options: LoginInteractiveOptions = {}
): Promise<BarndoorSDK> {
  if (!isNode) {
    throw new Error('Interactive login is only available in Node.js environment');
  }

  logger.info('Starting interactive login flow');

  const config = getStaticConfig();

  const {
    authDomain = config.authDomain,
    clientId = config.clientId,
    clientSecret = config.clientSecret,
    audience = config.apiAudience,
    apiBaseUrl: _apiBaseUrl = config.apiBaseUrl,
    port = 52765,
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
      // Try to use dynamic config with org ID substitution
      let sdkConfig: ReturnType<typeof getDynamicConfig>;
      if (hasOrganizationInfo(cachedToken)) {
        sdkConfig = getDynamicConfig(cachedToken);
      } else {
        logger.warn('Cached token has no organization information, using static config');
        sdkConfig = getStaticConfig();
      }

      const sdk = new BarndoorSDK(sdkConfig.apiBaseUrl, { token: cachedToken });
      await sdk.validateCachedToken();
      logger.info('Using cached valid token');
      return sdk;
    } catch (_error) {
      logger.info('Cached token invalid, starting OAuth flow');
    }
  } else {
    logger.info('No cached token, starting OAuth flow');
  }

  // 2. Start interactive PKCE flow (with manual fallback)
  const manual =
    typeof process !== 'undefined' &&
    !!(
      process.env &&
      (process.env['BARNDOOR_MANUAL_CODE'] === '1' ||
        process.env['BARNDOOR_MANUAL_CODE'] === 'true')
    );

  let redirectUri: string;
  let waiter: Promise<[string, string]> | null = null;

  if (manual) {
    const host = (process.env && process.env['BARNDOOR_REDIRECT_HOST']) || 'localhost';
    redirectUri = `http://${host}:${port}/cb`;
  } else {
    const tuple = startLocalCallbackServer(port);
    redirectUri = tuple[0];
    waiter = tuple[1];
  }

  // Create PKCE manager for this login session
  const pkceManager = new PKCEManager();
  const authUrl = await pkceManager.buildAuthorizationUrl({
    domain: authDomain,
    clientId,
    redirectUri,
    audience,
  });

  // Always print the URL so users can click it manually if auto-open fails
  logger.info(`Auth URL: ${authUrl}`);

  // Open browser
  const platform = os.platform();

  // Validate URL and open without invoking a shell
  let parsed: URL;
  try {
    parsed = new URL(authUrl);
  } catch {
    throw new Error('Invalid auth URL');
  }
  if (
    parsed.protocol !== 'https:' &&
    !(
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    )
  ) {
    throw new Error('Auth URL must use HTTPS (http allowed only for localhost)');
  }

  try {
    if (platform === 'darwin') {
      spawn('open', [authUrl], { detached: true, stdio: 'ignore' }).unref();
    } else if (platform === 'win32') {
      spawn('powershell', ['-NoProfile', 'Start-Process', authUrl], {
        detached: true,
        stdio: 'ignore',
      }).unref();
    } else {
      spawn('xdg-open', [authUrl], { detached: true, stdio: 'ignore' }).unref();
    }
    logger.info('Please complete login in your browser…');
  } catch (_error) {
    logger.warn('Failed to open browser automatically. Please visit:', authUrl);
  }

  // Obtain authorization code
  let code: string;
  if (manual) {
    // Prompt user to paste the code (or full redirected URL)
    const input = await new Promise<string>(resolve => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question('Paste the full redirected URL (or just the code= value): ', (answer: string) => {
        rl.close();
        resolve(answer.trim());
      });
    });
    try {
      // If user pasted full URL, extract code parameter; otherwise assume it's the code
      const maybeUrl = new URL(input);
      const c = maybeUrl.searchParams.get('code');
      code = c || input;
    } catch {
      code = input; // not a URL, treat as code
    }
  } else {
    const result = await (waiter as Promise<[string, string]>);
    code = result[0];
  }

  // Exchange code for token
  const tokenData = (await pkceManager.exchangeCodeForToken({
    domain: authDomain,
    clientId,
    clientSecret,
    code,
    redirectUri,
  })) as { access_token: string; [key: string]: unknown };

  // Save token and create SDK
  await saveUserToken(tokenData);

  // Try to use dynamic config with org ID substitution
  let sdkConfig: ReturnType<typeof getDynamicConfig>;
  if (hasOrganizationInfo(tokenData.access_token)) {
    sdkConfig = getDynamicConfig(tokenData.access_token);
  } else {
    logger.warn('New token has no organization information, using static config');
    sdkConfig = getStaticConfig();
  }

  return new BarndoorSDK(sdkConfig.apiBaseUrl, { token: tokenData.access_token });
}

/**
 * Ensure a server is connected, with user-friendly logging.
 *
 * This is a convenience wrapper around sdk.ensureServerConnected() that adds
 * helpful console output for interactive use. The actual connection logic
 * is handled by the SDK method to avoid code duplication.
 *
 * @param {BarndoorSDK} sdk - SDK instance
 * @param {string} serverIdentifier - Server slug or provider name
 * @param {Object} [options={}] - Options
 * @param {number} [options.timeout=90] - Maximum seconds to wait
 */
export async function ensureServerConnected(
  sdk: BarndoorSDK,
  serverIdentifier: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 90 } = options;

  logger.info(`Ensuring ${serverIdentifier} server is connected`);

  try {
    // Use the SDK method directly - it handles all the logic including server lookup
    await sdk.ensureServerConnected(serverIdentifier, { pollSeconds: timeout });
    logger.info(`Server ${serverIdentifier} connected successfully`);
  } catch (error) {
    if (error instanceof ServerNotFoundError) {
      logger.error(`Server '${serverIdentifier}' not found`);
    } else {
      logger.error(`Failed to connect to ${serverIdentifier}:`, error);
    }
    throw error;
  }
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
export async function makeMcpConnectionParams(
  sdk: BarndoorSDK,
  serverSlug: string,
  options: { proxyBaseUrl?: string; transport?: string } = {}
): Promise<[unknown, string]> {
  const {
    proxyBaseUrl: _proxyBaseUrl = 'http://proxy-ingress:8080',
    transport = 'streamable-http',
  } = options;

  // 1. Ensure server exists
  const servers = await sdk.listServers();
  const serverSlugs = new Set(servers.map(s => s.slug));

  if (!serverSlugs.has(serverSlug)) {
    throw new ServerNotFoundError(serverSlug, Array.from(serverSlugs));
  }

  // 2. Decide proxy vs public based on environment
  const env = (isNode ? process.env['BARNDOOR_ENV'] || process.env['MODE'] : '') || 'localdev';

  let url: string;
  if (['localdev', 'local', 'development', 'dev'].includes(env.toLowerCase())) {
    // Use dynamic configuration for local/dev environments
    if (hasOrganizationInfo(sdk.token)) {
      const dynamicConfig = getDynamicConfig(sdk.token);
      url = `${dynamicConfig.mcpBaseUrl}/mcp/${serverSlug}`;
    } else {
      logger.warn('Token has no organization information, using static config for MCP connection');
      const staticConfig = getStaticConfig();
      url = `${staticConfig.mcpBaseUrl}/mcp/${serverSlug}`;
    }
  } else {
    // Production - use external MCP URL (same as dynamic config)
    if (hasOrganizationInfo(sdk.token)) {
      const dynamicConfig = getDynamicConfig(sdk.token);
      url = `${dynamicConfig.mcpBaseUrl}/mcp/${serverSlug}`;
    } else {
      logger.warn('Token has no organization information, using static config for MCP connection');
      const staticConfig = getStaticConfig();
      url = `${staticConfig.mcpBaseUrl}/mcp/${serverSlug}`;
    }
  }

  const params = {
    url,
    transport,
    headers: {
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${sdk.token}`,
      'x-barndoor-session-id': generateSessionId(),
    },
  };

  return [params, url];
}

/**
 * Create and connect an MCP client for the specified server.
 *
 * This helper uses the official `@modelcontextprotocol/sdk` package so callers
 * don’t need to hand-craft JSON-RPC envelopes or manage transports manually.
 *
 * @param {BarndoorSDK} sdk – An initialized Barndoor SDK instance (must contain a valid JWT in `sdk.token`).
 * @param {string} serverSlug – The server slug (e.g. "salesforce", "notion").
 * @param {Object} [options] – Optional overrides passed to `makeMcpConnectionParams` (proxyBaseUrl, transport).
 * @returns {Promise<McpClient>} A connected MCP client ready for `listTools`, `callTool`, etc.
 */
export async function makeMcpClient(
  sdk: BarndoorSDK,
  serverSlug: string,
  options: { proxyBaseUrl?: string; transport?: string } = {}
): Promise<McpClient> {
  // 1. Build URL + headers via existing helper
  const [mcpParams] = await makeMcpConnectionParams(sdk, serverSlug, options);
  const params = mcpParams as { url: string; headers: Record<string, string> };

  // 2. Initialise MCP client
  const client = new McpClient({
    name: 'barndoor-js-sdk',
    version: '0.1.0',
  });

  // 3. Create transport (handles initialize + session negotiation)
  const transport = new StreamableHTTPClientTransport(new URL(params.url), {
    requestInit: {
      headers: params.headers,
    },
  });

  // 4. Connect (performs `initialize` and session negotiation)
  await client.connect(transport as any);
  return client;
}

/**
 * Generate a UUID v4 session ID.
 * @private
 */
function generateSessionId() {
  if (isNode && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.randomUUID) {
    return (globalThis as any).crypto.randomUUID();
  }
  // Secure fallback: generate UUID from cryptographically strong random bytes
  let bytes: Uint8Array;
  if (isNode && typeof crypto.randomBytes === 'function') {
    bytes = crypto.randomBytes(16);
  } else if (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.getRandomValues) {
    bytes = new Uint8Array(16);
    (globalThis as any).crypto.getRandomValues(bytes);
  } else {
    throw new Error('Secure random generator not available for UUID.');
  }
  // Set version (4) and variant (RFC 4122)
  const arr: Uint8Array = bytes ?? new Uint8Array(0);
  if (arr.length < 16) {
    throw new Error('Secure random generator not available for UUID.');
  }
  const b6 = arr[6]!;
  const b8 = arr[8]!;
  arr[6] = (b6 & 0x0f) | 0x40;
  arr[8] = (b8 & 0x3f) | 0x80;
  const hex = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
}
