# Barndoor JavaScript SDK - TypeScript Migration Core Files Dump
Generated: 2025-07-28T17:34:08.614Z
Total Files: 15

This file contains all core TypeScript files from the Barndoor SDK migration.
Each file is clearly marked with headers showing file path, directory, and line count.

## Table of Contents

1. [src/index.ts](#src-index-ts)
2. [src/client.ts](#src-client-ts)
3. [src/config.ts](#src-config-ts)
4. [src/models/index.ts](#src-models-index-ts)
5. [src/exceptions/index.ts](#src-exceptions-index-ts)
6. [src/http/client.ts](#src-http-client-ts)
7. [src/auth/index.ts](#src-auth-index-ts)
8. [src/auth/store.ts](#src-auth-store-ts)
9. [src/auth/pkce.ts](#src-auth-pkce-ts)
10. [src/quickstart.ts](#src-quickstart-ts)
11. [tsconfig.json](#tsconfig-json)
12. [package.json](#package-json)
13. [rollup.config.js](#rollup-config-js)
14. [.eslintrc.js](#-eslintrc-js)
15. [.prettierrc](#-prettierrc)

## Core TypeScript Files

================================================================================
FILE: src/index.ts
DIRECTORY: src
FILENAME: index.ts
LINES: 87
================================================================================

```ts
/**
 * Barndoor SDK - JavaScript client for the Barndoor Platform API.
 * 
 * The Barndoor SDK provides a simple, async interface for interacting with
 * the Barndoor platform, including:
 * 
 * - User authentication and token management
 * - MCP server discovery and connection
 * - OAuth flow handling for third-party integrations
 * - Agent credential exchange
 * 
 * Quick Start
 * -----------
 * ```javascript
 * import { BarndoorSDK } from '@barndoor/sdk';
 * 
 * const sdk = new BarndoorSDK('https://api.barndoor.host', { 
 *   token: 'your_token' 
 * });
 * const servers = await sdk.listServers();
 * ```
 * 
 * For interactive login:
 * ```javascript
 * import { loginInteractive } from '@barndoor/sdk';
 * 
 * const sdk = await loginInteractive();
 * ```
 */

// Main SDK class
export { BarndoorSDK } from './client';

// Exception classes
export {
  BarndoorError,
  AuthenticationError,
  TokenError,
  TokenExpiredError,
  TokenValidationError,
  ConnectionError,
  HTTPError,
  ServerNotFoundError,
  OAuthError,
  ConfigurationError,
  TimeoutError
} from './exceptions';

// Data models
export {
  ServerSummary,
  ServerDetail,
  AgentToken
} from './models';

// Quick-start helpers
export {
  loginInteractive,
  ensureServerConnected,
  makeMcpConnectionParams,
  makeMcpClient
} from './quickstart';

// Authentication utilities
export {
  buildAuthorizationUrl,
  exchangeCodeForToken,
  startLocalCallbackServer,
  validateState,
  clearPKCEState,
  loadUserToken,
  saveUserToken,
  clearCachedToken
} from './auth';

// Configuration
export {
  BarndoorConfig,
  getStaticConfig,
  getDynamicConfig,
  isBrowser,
  isNode
} from './config';

// Version
export const version = '0.1.0';

```

================================================================================
FILE: src/client.ts
DIRECTORY: src
FILENAME: client.ts
LINES: 419
================================================================================

```ts
/**
 * Main Barndoor SDK client.
 *
 * This module provides the primary BarndoorSDK class that mirrors the Python
 * SDK's client.py functionality with 100% API compatibility.
 */

import { HTTPClient, TimeoutConfig } from './http/client';
import { ServerSummary, ServerDetail } from './models';
import {
  HTTPError,
  ConfigurationError,
  TokenError,
  ServerNotFoundError
} from './exceptions';
import { getStaticConfig, isNode } from './config';
import { exec } from 'child_process';
import os from 'os';

/**
 * Configuration options for BarndoorSDK constructor.
 */
export interface BarndoorSDKOptions {
  /** User JWT token (required) */
  token: string;
  /** Whether to validate token on initialization */
  validateTokenOnInit?: boolean;
  /** Request timeout in seconds */
  timeout?: number;
  /** Maximum number of retries */
  maxRetries?: number;
}

/**
 * Options for ensureServerConnected method.
 */
export interface EnsureServerConnectedOptions {
  /** Maximum seconds to wait for connection */
  pollSeconds?: number;
}

/**
 * Response from server connection initiation.
 */
export interface ConnectionInitiationResponse {
  /** OAuth authorization URL */
  auth_url?: string;
  [key: string]: unknown;
}

/**
 * Response from connection status check.
 */
export interface ConnectionStatusResponse {
  /** Current connection status */
  status: string;
}

/**
 * Async client for interacting with the Barndoor Platform API.
 *
 * This SDK provides methods to:
 * - Manage server connections and OAuth flows
 * - List available MCP servers
 * - Validate user tokens
 *
 * The client handles authentication automatically by including the user's
 * JWT token in all requests.
 */
export class BarndoorSDK {
  /** Base URL of the Barndoor API */
  public readonly base: string;
  /** User JWT token */
  public readonly token: string;
  /** HTTP client instance */
  private readonly _http: HTTPClient;
  /** Whether token has been validated */
  private _tokenValidated: boolean;
  /** Whether the SDK has been closed */
  private _closed: boolean;

  /**
   * Create a new BarndoorSDK instance.
   * @param apiBaseUrl - Base URL of the Barndoor API
   * @param options - Configuration options (token is required)
   */
  constructor(apiBaseUrl: string, options: BarndoorSDKOptions) {
    const {
      token: barndoorToken,
      timeout = 30.0,
      maxRetries = 3
    } = options;

    // Validate inputs
    this.base = this._validateUrl(apiBaseUrl, 'API base URL').replace(/\/$/, '');

    // Get token from parameter - token must be provided explicitly
    if (!barndoorToken) {
      throw new Error(
        'Barndoor user token must be provided. Use loginInteractive() or provide token explicitly.'
      );
    }
    this.token = this._validateToken(barndoorToken);

    // Validate configuration
    if (typeof timeout !== 'number' || timeout <= 0) {
      throw new ConfigurationError('timeout must be a positive number');
    }
    if (!Number.isInteger(maxRetries) || maxRetries < 0) {
      throw new ConfigurationError('maxRetries must be a non-negative integer');
    }

    // Initialize HTTP client
    const timeoutConfig = new TimeoutConfig(timeout, timeout / 3);
    this._http = new HTTPClient(timeoutConfig, maxRetries);
    this._tokenValidated = false;
    this._closed = false;

    // eslint-disable-next-line no-console
    console.log(`Initialized BarndoorSDK for ${this.base}`);
  }
  
  /**
   * Validate URL format.
   * @private
   */
  private _validateUrl(url: string, name: string): string {
    if (!url || typeof url !== 'string') {
      throw new ConfigurationError(`${name} must be a non-empty string`);
    }

    try {
      new URL(url);
      return url;
    } catch (error) {
      throw new ConfigurationError(`${name} must be a valid URL`);
    }
  }

  /**
   * Validate token format.
   * @private
   */
  private _validateToken(token: string): string {
    if (!token || typeof token !== 'string') {
      throw new TokenError('Token must be a non-empty string');
    }

    // Basic JWT format validation
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new TokenError('Token must be a valid JWT');
    }

    return token;
  }

  /**
   * Ensure the SDK hasn't been closed.
   * @private
   */
  private _ensureNotClosed(): void {
    if (this._closed) {
      throw new Error('SDK has been closed. Create a new instance or use as context manager.');
    }
  }
  
  /**
   * Make authenticated request with automatic token validation.
   * @private
   */
  private async _req(method: string, path: string, options: Record<string, unknown> = {}): Promise<unknown> {
    this._ensureNotClosed();
    await this.ensureValidToken();

    const headers = (options['headers'] as Record<string, string>) ?? {};
    headers['Authorization'] = `Bearer ${this.token}`;

    const url = `${this.base}${path}`;
    return await this._http.request(method, url, { ...options, headers });
  }

  /**
   * Validate the cached token by making a test API call.
   * @returns True if the token is valid
   */
  public async validateCachedToken(): Promise<boolean> {
    if (!this.token) {
      return false;
    }

    try {
      // Use Auth0's userinfo endpoint for validation
      const config = getStaticConfig();
      const response = await fetch(`https://${config.authDomain}/userinfo`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      const isValid = response.ok;
      this._tokenValidated = true;
      return isValid;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Ensure token is valid, validating if necessary.
   */
  public async ensureValidToken(): Promise<void> {
    if (this._tokenValidated) {
      return;
    }

    // Skip validation in non-production environments
    const env = (isNode ? process.env['BARNDOOR_ENV'] : '') ?? 'localdev';
    if (['localdev', 'local', 'development', 'dev'].includes(env.toLowerCase())) {
      this._tokenValidated = true;
      return;
    }

    // Validate token in production
    const isValid = await this.validateCachedToken();
    if (!isValid) {
      throw new TokenError('Token validation failed. Please re-authenticate.');
    }

    this._tokenValidated = true;
  }

  /**
   * List all MCP servers available to the caller's organization.
   * @returns Array of server summaries
   */
  public async listServers(): Promise<ServerSummary[]> {
    // eslint-disable-next-line no-console
    console.log('Fetching server list');
    try {
      const response = await this._req('GET', '/servers') as unknown[];
      const servers = response.map(data => ServerSummary.fromApiResponse(data));
      // eslint-disable-next-line no-console
      console.log(`Retrieved ${servers.length} servers`);
      return servers;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to list servers:', error);
      throw error;
    }
  }
  
  /**
   * Get detailed information about a specific server.
   * @param serverId - Server ID
   * @returns Server details
   */
  public async getServer(serverId: string): Promise<ServerDetail> {
    const validatedServerId = this._validateServerId(serverId);

    // eslint-disable-next-line no-console
    console.log(`Fetching server details for ${validatedServerId}`);
    const response = await this._req('GET', `/servers/${validatedServerId}`);
    return ServerDetail.fromApiResponse(response);
  }

  /**
   * Initiate OAuth connection flow for a server.
   * @param serverId - Server ID
   * @param returnUrl - Optional return URL
   * @returns Connection initiation response
   */
  public async initiateConnection(serverId: string, returnUrl?: string): Promise<ConnectionInitiationResponse> {
    const validatedServerId = this._validateServerId(serverId);
    let validatedReturnUrl: string | undefined;

    if (returnUrl) {
      validatedReturnUrl = this._validateUrl(returnUrl, 'Return URL');
    }

    // eslint-disable-next-line no-console
    console.log(`Initiating connection for server ${validatedServerId}`);

    const params = validatedReturnUrl ? { return_url: validatedReturnUrl } : undefined;

    try {
      const response = await this._req('POST', `/servers/${validatedServerId}/connect`, {
        params,
        json: {}
      });
      return response as ConnectionInitiationResponse;
    } catch (error: unknown) {
      if (error instanceof HTTPError &&
          error.statusCode === 500 &&
          error.responseBody?.includes('OAuth server configuration not found')) {
        throw new Error(
          'Server is missing OAuth configuration. ' +
          'Ask an admin to configure credentials before initiating a connection.'
        );
      }
      throw error;
    }
  }
  
  /**
   * Get the user's connection status for a specific server.
   * @param serverId - Server ID
   * @returns Connection status
   */
  public async getConnectionStatus(serverId: string): Promise<string> {
    const validatedServerId = this._validateServerId(serverId);

    // eslint-disable-next-line no-console
    console.log(`Checking connection status for server ${validatedServerId}`);
    const response = await this._req('GET', `/servers/${validatedServerId}/connection`) as ConnectionStatusResponse;
    return response.status;
  }

  /**
   * Validate server ID format.
   * @private
   */
  private _validateServerId(serverId: string): string {
    if (!serverId || typeof serverId !== 'string') {
      throw new Error('Server ID must be a non-empty string');
    }

    // Basic UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(serverId)) {
      throw new Error('Server ID must be a valid UUID');
    }

    return serverId;
  }

  /**
   * Close the SDK and clean up resources.
   */
  public async close(): Promise<void> {
    if (!this._closed) {
      await this._http.close();
      this._closed = true;
    }
  }

  /**
   * Alias for close() to match Python SDK naming.
   */
  public async aclose(): Promise<void> {
    await this.close();
  }

  /**
   * Ensure a server is connected, initiating OAuth if needed.
   * @param serverIdentifier - Server slug or provider name
   * @param options - Options
   */
  public async ensureServerConnected(serverIdentifier: string, options: EnsureServerConnectedOptions = {}): Promise<void> {
    const { pollSeconds = 60 } = options;

    if (!isNode) {
      throw new Error('ensureServerConnected requires Node.js environment for browser opening');
    }

    // 1. Locate server
    const servers = await this.listServers();
    const target = servers.find(s =>
      s.slug === serverIdentifier ||
      (s.provider && s.provider.toLowerCase() === serverIdentifier.toLowerCase())
    );

    if (!target) {
      throw new ServerNotFoundError(serverIdentifier);
    }

    if (target.connection_status === 'connected') {
      return; // Already connected
    }

    // 2. Start OAuth flow
    const connection = await this.initiateConnection(target.id);
    const authUrl = connection.auth_url;
    if (!authUrl) {
      throw new Error('Registry did not return auth_url');
    }

    // 3. Open browser
    const platform = os.platform();

    let command: string;
    if (platform === 'darwin') {
      command = `open "${authUrl}"`;
    } else if (platform === 'win32') {
      command = `start "${authUrl}"`;
    } else {
      command = `xdg-open "${authUrl}"`;
    }

    exec(command, (error) => {
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('Failed to open browser:', error.message);
      }
    });

    // 4. Poll until connected or timeout
    for (let i = 0; i < pollSeconds; i++) {
      const status = await this.getConnectionStatus(target.id);
      if (status === 'connected') {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('OAuth connection was not completed in time');
  }
}

```

================================================================================
FILE: src/config.ts
DIRECTORY: src
FILENAME: config.ts
LINES: 267
================================================================================

```ts
/**
 * Configuration management for the Barndoor SDK.
 *
 * This module provides unified configuration that mirrors the Python SDK's
 * configuration system, supporting environment-specific defaults and
 * dynamic organization ID substitution.
 */

import { ConfigurationError } from './exceptions';

/**
 * Environment detection utilities
 */
export const isBrowser: boolean = typeof window !== 'undefined';
export const isNode: boolean = typeof process !== 'undefined' && Boolean(process.versions?.node);

/**
 * Browser window with optional ENV object for environment variables.
 */
declare global {
  interface Window {
    ENV?: Record<string, string>;
  }
}

/**
 * Configuration options for BarndoorConfig constructor.
 */
export interface BarndoorConfigOptions {
  /** Auth0 domain */
  authDomain?: string;
  /** OAuth client ID */
  clientId?: string;
  /** OAuth client secret */
  clientSecret?: string;
  /** API audience identifier */
  apiAudience?: string;
  /** API base URL template */
  apiBaseUrl?: string;
  /** MCP base URL template */
  mcpBaseUrl?: string;
  /** Environment name */
  environment?: string;
  /** Whether to prompt for login */
  promptForLogin?: boolean;
  /** Whether to skip login in local environment */
  skipLoginLocal?: boolean;
}

/**
 * Get environment variable value (works in both Node.js and browser)
 */
function getEnvVar(name: string, defaultValue = ''): string {
  if (isNode) {
    return process.env[name] ?? defaultValue;
  } else if (isBrowser && window.ENV) {
    // Browser environment with injected ENV object
    return window.ENV[name] ?? defaultValue;
  }
  return defaultValue;
}

/**
 * Unified configuration for the Barndoor SDK.
 *
 * Mirrors the Python SDK's BarndoorConfig class with environment-specific
 * defaults and support for organization ID templating.
 */
export class BarndoorConfig {
  /** Auth0 domain */
  public authDomain: string;
  /** OAuth client ID */
  public clientId: string;
  /** OAuth client secret */
  public clientSecret: string;
  /** API audience identifier */
  public apiAudience: string;
  /** API base URL template */
  public apiBaseUrl: string;
  /** MCP base URL template */
  public mcpBaseUrl: string;
  /** Environment name */
  public environment: string;
  /** Whether to prompt for login */
  public promptForLogin: boolean;
  /** Whether to skip login in local environment */
  public skipLoginLocal: boolean;

  /**
   * Create a new BarndoorConfig instance.
   * @param options - Configuration options
   */
  constructor(options: BarndoorConfigOptions = {}) {
    // Authentication settings
    this.authDomain = options.authDomain ?? (getEnvVar('AUTH_DOMAIN') || 'auth.barndoor.ai');
    this.clientId = options.clientId ?? (getEnvVar('AGENT_CLIENT_ID') || '');
    this.clientSecret = options.clientSecret ?? (getEnvVar('AGENT_CLIENT_SECRET') || '');
    this.apiAudience = options.apiAudience ?? (getEnvVar('API_AUDIENCE') || 'https://barndoor.ai/');

    // Environment settings
    this.environment = options.environment ??
                      (getEnvVar('MODE') ||
                      getEnvVar('BARNDOOR_ENV') ||
                      'production');

    // Runtime settings
    this.promptForLogin = options.promptForLogin ?? false;
    this.skipLoginLocal = options.skipLoginLocal ?? false;

    // Initialize URL properties (will be set by _setEnvironmentDefaults)
    this.apiBaseUrl = '';
    this.mcpBaseUrl = '';

    // Set environment-specific defaults
    this._setEnvironmentDefaults(options);
  }
  
  /**
   * Set environment-specific default URLs.
   * @private
   */
  private _setEnvironmentDefaults(options: BarndoorConfigOptions): void {
    const env = this.environment.toLowerCase();

    if (env === 'localdev' || env === 'local') {
      this.authDomain = this.authDomain || 'localhost:3001';
      this.apiBaseUrl = options.apiBaseUrl ??
                       (getEnvVar('BARNDOOR_API') ||
                       'http://localhost:8000');
      this.mcpBaseUrl = options.mcpBaseUrl ??
                       (getEnvVar('BARNDOOR_URL') ||
                       'http://localhost:8000');
    } else if (env === 'development' || env === 'dev') {
      this.apiBaseUrl = options.apiBaseUrl ??
                       (getEnvVar('BARNDOOR_API') ||
                       'https://{organization_id}.mcp.barndoordev.com');
      this.mcpBaseUrl = options.mcpBaseUrl ??
                       (getEnvVar('BARNDOOR_URL') ||
                       'https://{organization_id}.mcp.barndoordev.com');
    } else { // production
      this.apiBaseUrl = options.apiBaseUrl ??
                       (getEnvVar('BARNDOOR_API') ||
                       'https://{organization_id}.mcp.barndoor.ai');
      this.mcpBaseUrl = options.mcpBaseUrl ??
                       (getEnvVar('BARNDOOR_URL') ||
                       'https://{organization_id}.mcp.barndoor.ai');
    }
  }
  
  /**
   * Get static configuration (without organization ID substitution).
   * @returns Static configuration instance
   */
  public static getStaticConfig(): BarndoorConfig {
    return new BarndoorConfig();
  }

  /**
   * Get dynamic configuration with organization ID substituted.
   * @param jwtToken - JWT token to extract organization ID from
   * @returns Dynamic configuration instance
   */
  public static getDynamicConfig(jwtToken: string): BarndoorConfig {
    const config = new BarndoorConfig();

    try {
      // Extract organization ID from JWT token
      const orgId = extractOrganizationId(jwtToken);

      // Substitute {organization_id} in URLs
      config.apiBaseUrl = config.apiBaseUrl.replace('{organization_id}', orgId);
      config.mcpBaseUrl = config.mcpBaseUrl.replace('{organization_id}', orgId);

      return config;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ConfigurationError(`Failed to extract organization ID from token: ${errorMessage}`);
    }
  }

  /**
   * Validate the configuration.
   * @throws ConfigurationError if configuration is invalid
   */
  public validate(): void {
    if (!this.authDomain || this.authDomain.trim() === '') {
      throw new ConfigurationError('authDomain is required');
    }

    if (!this.apiAudience || this.apiAudience.trim() === '') {
      throw new ConfigurationError('apiAudience is required');
    }

    if (!this.apiBaseUrl || this.apiBaseUrl.trim() === '') {
      throw new ConfigurationError('apiBaseUrl is required');
    }

    if (!this.mcpBaseUrl || this.mcpBaseUrl.trim() === '') {
      throw new ConfigurationError('mcpBaseUrl is required');
    }
  }
}

/**
 * JWT payload interface for organization extraction.
 */
interface JWTPayload {
  user?: {
    organization_name?: string;
    organization_slug?: string;
  };
  'https://barndoor.ai/organization_slug'?: string;
  organization_slug?: string;
  org_slug?: string;
  [key: string]: unknown;
}

/**
 * Extract organization ID from JWT token.
 * @param jwtToken - JWT token
 * @returns Organization ID
 * @throws Error if token is invalid or organization ID not found
 */
function extractOrganizationId(jwtToken: string): string {
  try {
    const parts = jwtToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    const payload = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as JWTPayload;

    let orgSlug: string | undefined;
    if (payload.user && typeof payload.user === 'object') {
      orgSlug = payload.user.organization_name ?? payload.user.organization_slug;
    }
    if (!orgSlug) {
      orgSlug = payload['https://barndoor.ai/organization_slug'] ?? payload.organization_slug ?? payload.org_slug;
    }

    if (!orgSlug) {
      throw new Error('organization_name / organization_slug not found in token');
    }

    return orgSlug;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to decode JWT token: ${errorMessage}`);
  }
}

/**
 * Get static configuration instance.
 * @returns Static configuration instance
 */
export function getStaticConfig(): BarndoorConfig {
  return BarndoorConfig.getStaticConfig();
}

/**
 * Get dynamic configuration with organization ID substituted.
 * @param jwtToken - JWT token
 * @returns Dynamic configuration instance
 */
export function getDynamicConfig(jwtToken: string): BarndoorConfig {
  return BarndoorConfig.getDynamicConfig(jwtToken);
}

```

================================================================================
FILE: src/models/index.ts
DIRECTORY: src/models
FILENAME: index.ts
LINES: 157
================================================================================

```ts
/**
 * Data models for the Barndoor SDK.
 *
 * This module defines the data models used for API requests and responses,
 * providing type safety and validation that mirrors the Python SDK's Pydantic models.
 */

/**
 * Connection status for MCP servers.
 */
export type ConnectionStatus = 'available' | 'pending' | 'connected';

/**
 * Raw server data from API responses.
 */
export interface ServerSummaryData {
  /** Unique identifier (UUID) for the server */
  id: string;
  /** Human-readable name of the server */
  name: string;
  /** URL-friendly identifier used in API paths */
  slug: string;
  /** Third-party provider name (e.g., "github", "slack") */
  provider?: string | null;
  /** Current connection status */
  connection_status: ConnectionStatus;
}

/**
 * Summary information about an MCP server.
 *
 * Represents basic server information as returned by the list servers
 * endpoint. This is a lightweight representation suitable for listing
 * many servers at once.
 */
export class ServerSummary {
  /** Unique identifier (UUID) for the server */
  public readonly id: string;
  /** Human-readable name of the server */
  public readonly name: string;
  /** URL-friendly identifier used in API paths */
  public readonly slug: string;
  /** Third-party provider name (e.g., "github", "slack") */
  public readonly provider: string | null;
  /** Current connection status */
  public readonly connection_status: ConnectionStatus;

  /**
   * Create a new ServerSummary instance.
   * @param data - Server data from API response
   */
  constructor(data: ServerSummaryData) {
    this.id = data.id;
    this.name = data.name;
    this.slug = data.slug;
    this.provider = data.provider ?? null;
    this.connection_status = data.connection_status;

    // Validate required fields
    if (!this.id || !this.name || !this.slug || !this.connection_status) {
      throw new Error('ServerSummary missing required fields');
    }
  }

  /**
   * Create a ServerSummary from API response data.
   * @param data - Raw API response data
   * @returns ServerSummary instance
   */
  public static fromApiResponse(data: unknown): ServerSummary {
    return new ServerSummary(data as ServerSummaryData);
  }
}

/**
 * Raw server detail data from API responses.
 */
export interface ServerDetailData extends ServerSummaryData {
  /** MCP base URL from the server directory */
  url?: string | null;
}

/**
 * Detailed information about an MCP server.
 *
 * Extends ServerSummary with additional fields returned when fetching
 * a single server's details.
 */
export class ServerDetail extends ServerSummary {
  /** MCP base URL from the server directory */
  public readonly url: string | null;

  /**
   * Create a new ServerDetail instance.
   * @param data - Server data from API response
   */
  constructor(data: ServerDetailData) {
    super(data);
    this.url = data.url ?? null;
  }

  /**
   * Create a ServerDetail from API response data.
   * @param data - Raw API response data
   * @returns ServerDetail instance
   */
  public static override fromApiResponse(data: unknown): ServerDetail {
    return new ServerDetail(data as ServerDetailData);
  }
}

/**
 * Raw agent token data from API responses.
 */
export interface AgentTokenData {
  /** The agent access token to use for agent operations */
  agent_token: string;
  /** Token lifetime in seconds */
  expires_in: number;
}

/**
 * Response from the agent token exchange endpoint.
 *
 * Contains the agent access token and expiration information returned
 * when exchanging client credentials.
 */
export class AgentToken {
  /** The agent access token to use for agent operations */
  public readonly agent_token: string;
  /** Token lifetime in seconds */
  public readonly expires_in: number;

  /**
   * Create a new AgentToken instance.
   * @param data - Token data from API response
   */
  constructor(data: AgentTokenData) {
    this.agent_token = data.agent_token;
    this.expires_in = data.expires_in;

    // Validate required fields
    if (!this.agent_token || typeof this.expires_in !== 'number') {
      throw new Error('AgentToken missing required fields');
    }
  }

  /**
   * Create an AgentToken from API response data.
   * @param data - Raw API response data
   * @returns AgentToken instance
   */
  public static fromApiResponse(data: unknown): AgentToken {
    return new AgentToken(data as AgentTokenData);
  }
}

```

================================================================================
FILE: src/exceptions/index.ts
DIRECTORY: src/exceptions
FILENAME: index.ts
LINES: 198
================================================================================

```ts
/**
 * Exception classes for the Barndoor SDK.
 *
 * This module provides a complete hierarchy of error classes that mirror
 * the Python SDK exceptions exactly, ensuring API compatibility.
 */

/**
 * Base exception for all Barndoor SDK errors.
 */
export class BarndoorError extends Error {
  /**
   * Create a new BarndoorError.
   * @param message - Error message
   */
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Raised when authentication fails.
 */
export class AuthenticationError extends BarndoorError {
  /** Optional error code for specific authentication failures */
  public readonly errorCode: string | null;

  /**
   * Create a new AuthenticationError.
   * @param message - Error message
   * @param errorCode - Optional error code
   */
  constructor(message: string, errorCode: string | null = null) {
    super(message);
    this.errorCode = errorCode;
  }
}

/**
 * Raised when token operations fail.
 */
export class TokenError extends AuthenticationError {
  /** Optional help text for resolving the error */
  public readonly helpText: string | null;

  /**
   * Create a new TokenError.
   * @param message - Error message
   * @param helpText - Optional help text
   */
  constructor(message: string, helpText: string | null = null) {
    let fullMessage = message;
    if (helpText) {
      fullMessage += ` ${helpText}`;
    } else {
      fullMessage += " Run 'barndoor-login' to authenticate.";
    }

    super(fullMessage);
    this.helpText = helpText;
  }
}

/**
 * Raised when a token has expired.
 */
export class TokenExpiredError extends TokenError {}

/**
 * Raised when token validation fails.
 */
export class TokenValidationError extends TokenError {}

/**
 * Raised when unable to connect to the Barndoor API.
 */
export class ConnectionError extends BarndoorError {
  /** The URL that failed to connect */
  public readonly url: string;
  /** The original error that caused the connection failure */
  public readonly originalError: Error;

  /**
   * Create a new ConnectionError.
   * @param url - The URL that failed to connect
   * @param originalError - The original error that caused the failure
   */
  constructor(url: string, originalError: Error) {
    let userMessage: string;
    const errorStr = originalError.toString().toLowerCase();

    if (errorStr.includes('timeout')) {
      userMessage = `Connection to ${url} timed out. Please check your internet connection and try again.`;
    } else if (errorStr.includes('connection refused')) {
      userMessage = `Could not connect to ${url}. The service may be unavailable.`;
    } else if (errorStr.includes('name resolution') || errorStr.includes('getaddrinfo')) {
      userMessage = `Could not resolve hostname for ${url}. Please check the URL and your DNS settings.`;
    } else {
      userMessage = `Failed to connect to ${url}. Please check your internet connection.`;
    }

    super(userMessage);
    this.url = url;
    this.originalError = originalError;
  }
}

/**
 * Raised for HTTP error responses.
 */
export class HTTPError extends BarndoorError {
  /** HTTP status code */
  public readonly statusCode: number;
  /** Raw response body */
  public readonly responseBody: string | null;

  /**
   * Create a new HTTPError.
   * @param statusCode - HTTP status code
   * @param message - Error message
   * @param responseBody - Raw response body
   */
  constructor(statusCode: number, message: string, responseBody: string | null = null) {
    const userMessage = HTTPError._createUserFriendlyMessage(statusCode, message, responseBody);
    super(userMessage);
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }

  /**
   * Create a user-friendly error message based on HTTP status code.
   * @private
   */
  private static _createUserFriendlyMessage(statusCode: number, message: string, _responseBody: string | null): string {
    const baseMessage = `Request failed (HTTP ${statusCode})`;

    if (statusCode === 400) {
      return `${baseMessage}: Invalid request. Please check your input parameters.`;
    } else if (statusCode === 401) {
      return `${baseMessage}: Authentication failed. Please check your token or re-authenticate.`;
    } else if (statusCode === 403) {
      return `${baseMessage}: Access denied. You don't have permission for this operation.`;
    } else if (statusCode === 404) {
      return `${baseMessage}: Resource not found. Please check the server ID or URL.`;
    } else if (statusCode === 429) {
      return `${baseMessage}: Rate limit exceeded. Please wait before making more requests.`;
    } else if (statusCode >= 500 && statusCode < 600) {
      return `${baseMessage}: Server error. Please try again later or contact support.`;
    } else {
      return `${baseMessage}: ${message}`;
    }
  }
}

/**
 * Raised when a requested server is not found.
 */
export class ServerNotFoundError extends BarndoorError {
  /** The server identifier that was not found */
  public readonly serverIdentifier: string;
  /** List of available servers, if provided */
  public readonly availableServers: string[] | null;

  /**
   * Create a new ServerNotFoundError.
   * @param serverIdentifier - The server identifier that was not found
   * @param availableServers - Optional list of available servers
   */
  constructor(serverIdentifier: string, availableServers: string[] | null = null) {
    let message = `Server '${serverIdentifier}' not found`;
    if (availableServers) {
      message += `. Available servers: ${availableServers.join(', ')}`;
    } else {
      message += ". Use listServers() to see available servers.";
    }

    super(message);
    this.serverIdentifier = serverIdentifier;
    this.availableServers = availableServers;
  }
}

/**
 * Raised when OAuth authentication fails.
 */
export class OAuthError extends AuthenticationError {}

/**
 * Raised when there's an issue with SDK configuration.
 */
export class ConfigurationError extends BarndoorError {}

/**
 * Raised when an operation times out.
 */
export class TimeoutError extends BarndoorError {}

```

================================================================================
FILE: src/http/client.ts
DIRECTORY: src/http
FILENAME: client.ts
LINES: 197
================================================================================

```ts
/**
 * HTTP client with retry logic and error handling.
 *
 * This module provides a robust HTTP client that mirrors the Python SDK's
 * HTTP client functionality, including automatic retries, timeout handling,
 * and proper error conversion.
 */

import fetch from 'cross-fetch';
import { HTTPError, ConnectionError, TimeoutError } from '../exceptions';

/**
 * HTTP request options interface.
 */
export interface HTTPRequestOptions {
  /** Request headers */
  headers?: Record<string, string>;
  /** JSON body to send */
  json?: unknown;
  /** Query parameters */
  params?: Record<string, string | number | boolean>;
  /** Additional fetch options */
  [key: string]: unknown;
}

/**
 * Timeout configuration for HTTP requests.
 */
export class TimeoutConfig {
  /** Read timeout in milliseconds */
  public readonly read: number;
  /** Connect timeout in milliseconds */
  public readonly connect: number;

  /**
   * Create a new TimeoutConfig.
   * @param read - Read timeout in seconds
   * @param connect - Connect timeout in seconds
   */
  constructor(read = 30, connect = 10) {
    this.read = read * 1000; // Convert to milliseconds
    this.connect = connect * 1000; // Convert to milliseconds
  }
}

/**
 * HTTP client with automatic retries and error handling.
 *
 * Provides a consistent interface for making HTTP requests with proper
 * error handling, timeout management, and retry logic.
 */
export class HTTPClient {
  /** Timeout configuration */
  private readonly timeoutConfig: TimeoutConfig;
  /** Maximum number of retries */
  private readonly maxRetries: number;
  /** Whether the client has been closed */
  public closed: boolean;

  /**
   * Create a new HTTPClient.
   * @param timeoutConfig - Timeout configuration
   * @param maxRetries - Maximum number of retries
   */
  constructor(timeoutConfig = new TimeoutConfig(), maxRetries = 3) {
    this.timeoutConfig = timeoutConfig;
    this.maxRetries = maxRetries;
    this.closed = false;
  }

  /**
   * Make an HTTP request with retry logic.
   * @param method - HTTP method
   * @param url - Request URL
   * @param options - Request options
   * @returns Response data
   */
  public async request(method: string, url: string, options: HTTPRequestOptions = {}): Promise<unknown> {
    if (this.closed) {
      throw new Error('HTTP client has been closed');
    }

    const { headers = {}, json, params, ...fetchOptions } = options;

    // Build URL with query parameters
    const requestUrl = this._buildUrl(url, params);

    // Prepare request options
    const requestOptions: RequestInit = {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'barndoor-js-sdk/0.1.0',
        ...headers
      },
      ...fetchOptions
    };

    // Add request body if provided
    if (json) {
      requestOptions.body = JSON.stringify(json);
    }

    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutConfig.read);
    requestOptions.signal = controller.signal;

    let lastError: Error | undefined;

    // Retry loop
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(requestUrl, requestOptions);
        clearTimeout(timeoutId);

        // Handle HTTP errors
        if (!response.ok) {
          const responseText = await response.text();
          throw new HTTPError(response.status, response.statusText, responseText);
        }

        // Parse JSON response
        const responseData = await response.json();
        return responseData;
        
      } catch (error: unknown) {
        clearTimeout(timeoutId);

        // Handle different types of errors
        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new TimeoutError(`Request to ${requestUrl} timed out after ${this.timeoutConfig.read}ms`);
        } else if (error instanceof HTTPError) {
          // Don't retry HTTP errors (4xx, 5xx)
          throw error;
        } else if (error instanceof Error && error.name === 'TypeError' && error.message.includes('fetch')) {
          lastError = new ConnectionError(requestUrl, error);
        } else {
          lastError = error instanceof Error ? error : new Error(String(error));
        }

        // Don't retry on the last attempt
        if (attempt === this.maxRetries) {
          break;
        }

        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await this._sleep(delay);
      }
    }

    throw lastError;
  }
  
  /**
   * Build URL with query parameters.
   * @private
   */
  private _buildUrl(baseUrl: string, params?: Record<string, string | number | boolean>): string {
    if (!params || Object.keys(params).length === 0) {
      return baseUrl;
    }

    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });

    return url.toString();
  }

  /**
   * Sleep for the specified number of milliseconds.
   * @private
   */
  private _sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close the HTTP client and clean up resources.
   */
  public async close(): Promise<void> {
    this.closed = true;
  }

  /**
   * Alias for close() to match Python SDK naming.
   */
  public async aclose(): Promise<void> {
    await this.close();
  }
}

```

================================================================================
FILE: src/auth/index.ts
DIRECTORY: src/auth
FILENAME: index.ts
LINES: 27
================================================================================

```ts
/**
 * Authentication module exports.
 * 
 * This module provides a unified interface for authentication functionality,
 * including PKCE OAuth flows, token storage, and interactive login.
 */

export {
  buildAuthorizationUrl,
  exchangeCodeForToken,
  startLocalCallbackServer,
  validateState,
  clearPKCEState
} from './pkce';

export {
  getTokenStorage,
  TokenManager,
  loadUserToken,
  saveUserToken,
  clearCachedToken
} from './store';

// Re-export types
export type { AuthorizationUrlParams, TokenExchangeParams, PKCEState } from './pkce';
export type { TokenData } from './store';

```

================================================================================
FILE: src/auth/store.ts
DIRECTORY: src/auth
FILENAME: store.ts
LINES: 333
================================================================================

```ts
/**
 * Token storage and management.
 *
 * This module provides token storage that works in both browser and Node.js
 * environments, mirroring the Python SDK's auth_store functionality.
 */

import { isBrowser, isNode } from '../config';
import { TokenError, TokenExpiredError } from '../exceptions';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

/**
 * Token data structure for storage.
 */
export interface TokenData {
  /** Access token for API requests */
  access_token: string;
  /** Optional refresh token */
  refresh_token?: string;
  /** Token type (usually 'Bearer') */
  token_type?: string;
  /** Token expiration time in seconds */
  expires_in?: number;
  /** Token scope */
  scope?: string;
  /** Additional token properties */
  [key: string]: unknown;
}

/**
 * Abstract base class for token storage.
 */
abstract class TokenStorage {
  /**
   * Load token data from storage.
   * @returns Token data or null if not found
   */
  abstract loadToken(): Promise<TokenData | null>;

  /**
   * Save token data to storage.
   * @param tokenData - Token data to save
   */
  abstract saveToken(tokenData: TokenData): Promise<void>;

  /**
   * Clear token data from storage.
   */
  abstract clearToken(): Promise<void>;
}

/**
 * Browser-based token storage using localStorage.
 */
class BrowserTokenStorage extends TokenStorage {
  /** Storage key for localStorage */
  private readonly storageKey: string;

  constructor() {
    super();
    this.storageKey = 'barndoor_token';
  }

  public async loadToken(): Promise<TokenData | null> {
    try {
      const tokenData = localStorage.getItem(this.storageKey);
      return tokenData ? JSON.parse(tokenData) as TokenData : null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Failed to load token from localStorage:', error);
      return null;
    }
  }

  public async saveToken(tokenData: TokenData): Promise<void> {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(tokenData));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new TokenError(`Failed to save token: ${errorMessage}`);
    }
  }

  public async clearToken(): Promise<void> {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Failed to clear token from localStorage:', error);
    }
  }
}

/**
 * Node.js-based token storage using file system.
 */
class NodeTokenStorage extends TokenStorage {
  /** Path to the token file */
  private readonly tokenFile: string;

  constructor() {
    super();
    this.tokenFile = this._getTokenFilePath();
  }

  private _getTokenFilePath(): string {
    if (isNode) {
      return path.join(os.homedir(), '.barndoor', 'token.json');
    }
    throw new Error('NodeTokenStorage can only be used in Node.js environment');
  }

  public async loadToken(): Promise<TokenData | null> {
    if (!isNode) {
      throw new Error('NodeTokenStorage can only be used in Node.js environment');
    }

    try {
      const tokenData = await fs.readFile(this.tokenFile, 'utf8');
      return JSON.parse(tokenData) as TokenData;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return null; // File doesn't exist
      }
      // eslint-disable-next-line no-console
      console.warn('Failed to load token from file:', error);
      return null;
    }
  }
  
  public async saveToken(tokenData: TokenData): Promise<void> {
    if (!isNode) {
      throw new Error('NodeTokenStorage can only be used in Node.js environment');
    }

    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.tokenFile), { recursive: true });

      // Write token file with restrictive permissions
      await fs.writeFile(this.tokenFile, JSON.stringify(tokenData, null, 2));
      await fs.chmod(this.tokenFile, 0o600);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new TokenError(`Failed to save token: ${errorMessage}`);
    }
  }

  public async clearToken(): Promise<void> {
    if (!isNode) {
      throw new Error('NodeTokenStorage can only be used in Node.js environment');
    }

    try {
      await fs.unlink(this.tokenFile);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
        // eslint-disable-next-line no-console
        console.warn('Failed to clear token file:', error);
      }
    }
  }
}

/**
 * Get the appropriate token storage for the current environment.
 * @returns Token storage instance
 */
export function getTokenStorage(): TokenStorage {
  if (isBrowser) {
    return new BrowserTokenStorage();
  } else if (isNode) {
    return new NodeTokenStorage();
  } else {
    throw new Error('Unsupported environment for token storage');
  }
}

/**
 * Token manager that handles storage, validation, and refresh.
 */
export class TokenManager {
  /** Token storage instance */
  private readonly storage: TokenStorage;

  /**
   * Create a new TokenManager.
   * @param _apiBaseUrl - Base URL for the API (currently unused)
   */
  constructor(_apiBaseUrl: string) {
    this.storage = getTokenStorage();
  }
  
  /**
   * Get a valid token, refreshing if necessary.
   * @returns Valid access token
   */
  public async getValidToken(): Promise<string> {
    const tokenData = await this.storage.loadToken();

    if (!tokenData) {
      throw new TokenError('No token found. Please authenticate.');
    }

    try {
      const validatedTokenData = await this._validateOrRefresh(tokenData);
      await this.storage.saveToken(validatedTokenData);
      return validatedTokenData.access_token;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Token validation/refresh failed:', error);
      throw new TokenExpiredError('Token expired and refresh failed. Please re-authenticate.');
    }
  }

  /**
   * Validate token or refresh if needed.
   * @private
   */
  private async _validateOrRefresh(tokenData: TokenData): Promise<TokenData> {
    const accessToken = tokenData.access_token;

    // Try local JWT validation first
    if (this._isTokenValidLocally(accessToken)) {
      return tokenData;
    }

    // Try remote validation
    if (await this._isTokenValidRemote(accessToken)) {
      return tokenData;
    }

    // Token is invalid, try to refresh
    if (tokenData.refresh_token) {
      const newTokenData = await this._refreshToken(tokenData);
      return { ...tokenData, ...newTokenData };
    }

    throw new TokenExpiredError('Token expired and no refresh token available');
  }
  
  /**
   * Validate token locally by checking expiration.
   * @private
   */
  private _isTokenValidLocally(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return false;
      }

      const payload = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
      const now = Math.floor(Date.now() / 1000);

      return Boolean(payload.exp && payload.exp > now);
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate token remotely using Auth0's userinfo endpoint.
   * @private
   */
  private async _isTokenValidRemote(token: string): Promise<boolean> {
    try {
      const response = await fetch(`https://auth.barndoor.ai/userinfo`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Refresh the access token using the refresh token.
   * @private
   */
  private async _refreshToken(_tokenData: TokenData): Promise<Partial<TokenData>> {
    // This would need to be implemented based on the OAuth provider's refresh endpoint
    // For now, throw an error to indicate refresh is not yet implemented
    throw new Error('Token refresh not yet implemented in JavaScript SDK');
  }
}

// Legacy functions for backward compatibility

/**
 * Load user token from storage.
 * @returns User access token or null if not found
 */
export async function loadUserToken(): Promise<string | null> {
  try {
    const storage = getTokenStorage();
    const tokenData = await storage.loadToken();
    return tokenData?.access_token ?? null;
  } catch (error) {
    return null;
  }
}

/**
 * Save user token to storage.
 * @param token - Token string or token data object
 */
export async function saveUserToken(token: string | TokenData): Promise<void> {
  const storage = getTokenStorage();

  let tokenData: TokenData;
  if (typeof token === 'string') {
    tokenData = { access_token: token };
  } else {
    tokenData = token;
  }

  await storage.saveToken(tokenData);
}

/**
 * Clear cached token.
 */
export async function clearCachedToken(): Promise<void> {
  const storage = getTokenStorage();
  await storage.clearToken();
}

```

================================================================================
FILE: src/auth/pkce.ts
DIRECTORY: src/auth
FILENAME: pkce.ts
LINES: 309
================================================================================

```ts
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

```

================================================================================
FILE: src/quickstart.ts
DIRECTORY: src
FILENAME: quickstart.ts
LINES: 296
================================================================================

```ts
/**
 * Quick-start helpers for the Barndoor SDK.
 * 
 * This module provides convenience functions that remove boilerplate code
 * commonly needed in examples and prototypes, mirroring the Python SDK's
 * quickstart.py functionality.
 */

import { BarndoorSDK } from './client';
import {
  buildAuthorizationUrl,
  exchangeCodeForToken,
  startLocalCallbackServer
} from './auth';
import { loadUserToken, saveUserToken } from './auth';
import { getStaticConfig, getDynamicConfig, isNode } from './config';
import { ServerNotFoundError } from './exceptions';
import { exec } from 'child_process';
import os from 'os';
import crypto from 'crypto';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

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

export async function loginInteractive(options: LoginInteractiveOptions = {}): Promise<BarndoorSDK> {
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
    apiBaseUrl: _apiBaseUrl = config.apiBaseUrl,
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
      // Use dynamic config with org ID substitution
      const dynamicConfig = getDynamicConfig(cachedToken);
      const sdk = new BarndoorSDK(dynamicConfig.apiBaseUrl, { token: cachedToken });
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
  const platform = os.platform();
  
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
  const [code, _state] = await waiter;
  
  // Exchange code for token
  const tokenData = await exchangeCodeForToken({
    domain: authDomain,
    clientId,
    clientSecret,
    code,
    redirectUri
  }) as { access_token: string; [key: string]: unknown };

  // Save token and create SDK
  await saveUserToken(tokenData);
  // Use dynamic config with org ID substitution
  const dynamicConfig = getDynamicConfig(tokenData.access_token);
  return new BarndoorSDK(dynamicConfig.apiBaseUrl, { token: tokenData.access_token });
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
export async function ensureServerConnected(sdk: BarndoorSDK, serverIdentifier: string, options: { timeout?: number } = {}): Promise<void> {
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
export async function makeMcpConnectionParams(sdk: BarndoorSDK, serverSlug: string, options: { proxyBaseUrl?: string; transport?: string } = {}): Promise<[unknown, string]> {
  const {
    proxyBaseUrl: _proxyBaseUrl = 'http://proxy-ingress:8080',
    transport = 'streamable-http'
  } = options;
  
  // 1. Ensure server exists
  const servers = await sdk.listServers();
  const serverSlugs = new Set(servers.map(s => s.slug));
  
  if (!serverSlugs.has(serverSlug)) {
    throw new ServerNotFoundError(serverSlug, Array.from(serverSlugs));
  }
  
  // 2. Decide proxy vs public based on environment
  const env = (isNode ? process.env['BARNDOOR_ENV'] || process.env['MODE'] : '') || 'localdev';
  
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
export async function makeMcpClient(sdk: BarndoorSDK, serverSlug: string, options: { proxyBaseUrl?: string; transport?: string } = {}): Promise<McpClient> {
  // 1. Build URL + headers via existing helper
  const [mcpParams] = await makeMcpConnectionParams(sdk, serverSlug, options);
  const params = mcpParams as { url: string; headers: Record<string, string> };

  // 2. Initialise MCP client
  const client = new McpClient({
    name: 'barndoor-js-sdk',
    version: '0.1.0'
  });

  // 3. Create transport (handles initialize + session negotiation)
  const transport = new StreamableHTTPClientTransport(new URL(params.url), {
    requestInit: {
      headers: params.headers
    }
  });

  // 4. Connect (performs `initialize` and session negotiation)
  await client.connect(transport as any);
  return client;
}

/**
 * Build external MCP URL for production environments.
 * @private
 */
function buildExternalMcpUrl(serverSlug: string, jwtToken: string, _env: string): string {
  // Placeholder implementation – production environments may have custom logic
  const config = getDynamicConfig(jwtToken);
  return `${config.mcpBaseUrl}/mcp/${serverSlug}`;
}

/**
 * Generate a UUID v4 session ID.
 * @private
 */
function generateSessionId() {
  if (isNode && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 8);
    return v.toString(16);
  });
}
```

================================================================================
FILE: tsconfig.json
DIRECTORY: .
FILENAME: tsconfig.json
LINES: 62
================================================================================

```json
{
  "compilerOptions": {
    // Language and Environment
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    
    // Type Checking - Strict Mode
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    
    // Additional Checks
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noPropertyAccessFromIndexSignature": true,
    
    // Emit
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "removeComments": false,
    "importHelpers": true,
    
    // Interop Constraints
    "isolatedModules": true,
    "allowJs": false,
    "checkJs": false,
    
    // Skip type checking of declaration files
    "skipLibCheck": true
  },
  "include": [
    "src/**/*",
    "test/**/*",
    "examples/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.js"
  ],
  "ts-node": {
    "esm": true
  }
}

```

================================================================================
FILE: package.json
DIRECTORY: .
FILENAME: package.json
LINES: 76
================================================================================

```json
{
  "name": "@barndoor/sdk",
  "version": "0.1.0",
  "description": "JavaScript client for the Barndoor Platform API",
  "type": "module",
  "main": "dist/index.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.esm.js",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "npm run build:types && rollup -c",
    "build:types": "node node_modules/typescript/lib/tsc.js --emitDeclarationOnly",
    "dev": "rollup -c -w",
    "test": "node --experimental-vm-modules node_modules/.bin/jest",
    "test:watch": "node --experimental-vm-modules node_modules/.bin/jest --watch",
    "lint": "eslint src/ test/ examples/",
    "lint:fix": "eslint src/ test/ examples/ --fix",
    "format": "prettier --write src/ test/ examples/",
    "format:check": "prettier --check src/ test/ examples/",
    "type-check": "node node_modules/typescript/lib/tsc.js --noEmit",
    "type-coverage": "type-coverage --at-least 60 --strict",
    "safety-check": "../scripts/safety-check.sh"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.17.0",
    "cross-fetch": "^4.0.0",
    "dotenv": "^17.2.1",
    "jose": "^5.0.0"
  },
  "optionalDependencies": {
    "openai": "^4.104.0"
  },
  "devDependencies": {
    "@babel/core": "^7.28.0",
    "@babel/preset-env": "^7.28.0",
    "@rollup/plugin-commonjs": "^25.0.0",
    "@rollup/plugin-json": "^6.1.0",
    "@rollup/plugin-node-resolve": "^15.0.0",
    "@rollup/plugin-terser": "^0.4.0",
    "@rollup/plugin-typescript": "^12.1.4",
    "@typescript-eslint/eslint-plugin": "^8.38.0",
    "@typescript-eslint/parser": "^8.38.0",
    "babel-jest": "^30.0.5",
    "eslint": "^8.0.0",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-prettier": "^5.5.3",
    "jest": "^29.0.0",
    "prettier": "^3.6.2",
    "rollup": "^3.29.4",
    "type-coverage": "^2.29.7",
    "typescript": "^5.8.3"
  },
  "keywords": [
    "barndoor",
    "mcp",
    "ai",
    "sdk"
  ],
  "author": "Barndoor",
  "typeCoverage": {
    "atLeast": 60,
    "strict": true,
    "ignoreCatch": true,
    "ignoreFiles": [
      "**/*.test.ts",
      "examples/**/*"
    ]
  }
}

```

================================================================================
FILE: rollup.config.js
DIRECTORY: .
FILENAME: rollup.config.js
LINES: 50
================================================================================

```js
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';

export default [
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      exports: 'named'
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false, // We'll generate declarations separately
        declarationMap: false
      }),
      resolve({ preferBuiltins: true }),
      commonjs(),
      json(),
      terser()
    ],
    external: ['cross-fetch', 'jose', 'fs', 'path', 'os', '@modelcontextprotocol/sdk']
  },
  // ES Module build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'es'
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false, // We'll generate declarations separately
        declarationMap: false
      }),
      resolve({ preferBuiltins: true }),
      commonjs(),
      json(),
      terser()
    ],
    external: ['cross-fetch', 'jose', 'fs', 'path', 'os', '@modelcontextprotocol/sdk']
  }
];

```

## Configuration Files

================================================================================
FILE: .eslintrc.js
DIRECTORY: .
FILENAME: .eslintrc.js
LINES: 66
================================================================================

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'prettier'
  ],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    '@typescript-eslint/recommended-requiring-type-checking',
    'prettier'
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  env: {
    node: true,
    es2020: true,
    jest: true
  },
  rules: {
    // Prettier integration
    'prettier/prettier': 'error',
    
    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/explicit-module-boundary-types': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/strict-boolean-expressions': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/require-await': 'error',
    
    // General rules
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-template': 'error'
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off'
      }
    },
    {
      files: ['examples/**/*.ts'],
      rules: {
        'no-console': 'off'
      }
    }
  ]
};

```

================================================================================
FILE: .prettierrc
DIRECTORY: .
FILENAME: .prettierrc
LINES: 14
================================================================================

```text
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "avoid",
  "endOfLine": "lf",
  "quoteProps": "as-needed"
}

```
