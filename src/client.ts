/**
 * Main Barndoor SDK client.
 *
 * This module provides the primary BarndoorSDK class that mirrors the Python
 * SDK's client.py functionality with 100% API compatibility.
 */

import { HTTPClient, TimeoutConfig } from './http/client';
import { ServerSummary, ServerDetail } from './models';
import { HTTPError, ConfigurationError, TokenError, ServerNotFoundError } from './exceptions';
import { getStaticConfig, isNode } from './config';
import { createScopedLogger } from './logging';
import { spawn } from 'child_process';
import os from 'os';

/**
 * Configuration options for BarndoorSDK constructor.
 */
export interface BarndoorSDKOptions {
  /** User JWT token (optional - can be set later via authenticate()) */
  token?: string;
  /** Whether to validate token on initialization */
  validateTokenOnInit?: boolean;
  /** Request timeout in seconds */
  timeout?: number;
  /** Maximum number of retries */
  maxRetries?: number;
}

/**
 * Pagination metadata for API responses.
 */
interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  pages: number;
  previous_page: number | null;
  next_page: number | null;
}

/**
 * Paginated API response structure.
 */
interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMetadata;
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
  private _token: string | null;
  /** HTTP client instance */
  private readonly _http: HTTPClient;
  /** Whether token has been validated */
  private _tokenValidated: boolean;
  /** Whether the SDK has been closed */
  private _closed: boolean;
  /** Scoped logger for this SDK instance */
  private readonly _logger = createScopedLogger('client');

  /**
   * Create a new BarndoorSDK instance.
   * @param apiBaseUrl - Base URL of the Barndoor API
   * @param options - Configuration options (token is optional)
   */
  constructor(apiBaseUrl: string, options: BarndoorSDKOptions = {}) {
    const { token: barndoorToken, timeout = 30.0, maxRetries = 3 } = options;

    // Validate inputs
    this.base = this._validateUrl(apiBaseUrl, 'API base URL').replace(/\/$/, '');

    // Token is optional - can be set later via authenticate(). If provided, validate even if empty string.
    const hasTokenProp = Object.prototype.hasOwnProperty.call(options, 'token');
    this._token = hasTokenProp ? this._validateToken(barndoorToken as unknown as string) : null;

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

    this._logger.info(`Initialized BarndoorSDK for ${this.base}`);
  }

  /**
   * Get the current token.
   */
  public get token(): string {
    if (!this._token) {
      throw new Error(
        'No token available. Call authenticate() first or provide token in constructor.'
      );
    }
    return this._token;
  }

  /**
   * Set authentication token for the SDK.
   * @param token - JWT token to use for authentication
   */
  public async authenticate(token: string): Promise<void> {
    this._token = this._validateToken(token);
    this._tokenValidated = false; // Reset validation status

    // Optionally validate the token immediately
    await this.ensureValidToken();

    this._logger.info('Authentication successful');
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
    } catch (_error) {
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
  private async _req(
    method: string,
    path: string,
    options: Record<string, unknown> = {}
  ): Promise<unknown> {
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

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch(`https://${config.authDomain}/userinfo`, {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
          signal: controller.signal,
        });

        const isValid = response.ok;
        // Only set _tokenValidated to true if the token is actually valid
        if (isValid) {
          this._tokenValidated = true;
        }
        return isValid;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (_error) {
      return false;
    }
  }

  /**
   * Ensure token is valid, validating if necessary.
   */
  public async ensureValidToken(): Promise<void> {
    // First check if we have a token at all
    if (!this._token) {
      throw new Error(
        'No token available. Call authenticate() first or provide token in constructor.'
      );
    }

    if (this._tokenValidated) {
      return;
    }

    // Skip validation only in explicit test/CI environments
    const env = (isNode ? process.env['BARNDOOR_ENV'] : '') ?? '';
    if (['test', 'ci'].includes(env.toLowerCase())) {
      this._tokenValidated = true;
      return;
    }

    // Validate token in all other environments (including staging, dev, prod)
    const isValid = await this.validateCachedToken();
    if (!isValid) {
      throw new TokenError('Token validation failed. Please re-authenticate.');
    }

    this._tokenValidated = true;
  }

  /**
   * List all MCP servers available to the caller's organization.
   * Automatically fetches all pages if results are paginated.
   * @returns Array of server summaries
   */
  public async listServers(): Promise<ServerSummary[]> {
    this._logger.debug('Fetching server list');
    try {
      const allServers: ServerSummary[] = [];
      let nextPage: number | null = 1;

      // Fetch all pages
      while (nextPage !== null) {
        const url = nextPage === 1 ? '/servers' : `/servers?page=${nextPage}`;
        const response = (await this._req('GET', url)) as PaginatedResponse<unknown>;

        const servers = response.data.map(data => ServerSummary.fromApiResponse(data));
        allServers.push(...servers);

        // Check if there's a next page
        nextPage = response.pagination.next_page;
      }

      this._logger.info(`Retrieved ${allServers.length} servers total`);
      return allServers;
    } catch (error) {
      this._logger.error('Failed to list servers:', error);
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

    this._logger.info(`Fetching server details for ${validatedServerId}`);
    const response = await this._req('GET', `/servers/${validatedServerId}`);
    return ServerDetail.fromApiResponse(response);
  }

  /**
   * Initiate OAuth connection flow for a server.
   * @param serverId - Server ID
   * @param returnUrl - Optional return URL
   * @returns Connection initiation response
   */
  public async initiateConnection(
    serverId: string,
    returnUrl?: string
  ): Promise<ConnectionInitiationResponse> {
    const validatedServerId = this._validateServerId(serverId);
    let validatedReturnUrl: string | undefined;

    if (returnUrl) {
      validatedReturnUrl = this._validateUrl(returnUrl, 'Return URL');
    }

    this._logger.info(`Initiating connection for server ${validatedServerId}`);

    const params = validatedReturnUrl ? { return_url: validatedReturnUrl } : undefined;

    try {
      const response = await this._req('POST', `/servers/${validatedServerId}/connect`, {
        params,
        json: {},
      });
      return response as ConnectionInitiationResponse;
    } catch (error: unknown) {
      if (
        error instanceof HTTPError &&
        error.statusCode === 500 &&
        error.responseBody?.includes('OAuth server configuration not found')
      ) {
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

    this._logger.info(`Checking connection status for server ${validatedServerId}`);
    const response = (await this._req(
      'GET',
      `/servers/${validatedServerId}/connection`
    )) as ConnectionStatusResponse;
    return response.status;
  }

  /**
   * Disconnect from a specific MCP server.
   *
   * This will remove the connection record and clean up any stored OAuth credentials.
   * The user will need to reconnect to use this server again.
   *
   * @param serverId - Server ID or slug to disconnect from
   */
  public async disconnectServer(serverId: string): Promise<void> {
    const validatedServerId = this._validateServerId(serverId);

    this._logger.info(`Disconnecting from server ${validatedServerId}`);

    try {
      await this._req('DELETE', `/servers/${validatedServerId}/connection`);
      this._logger.info(`Successfully disconnected from server ${validatedServerId}`);
    } catch (error: unknown) {
      if (error instanceof HTTPError && error.statusCode === 404) {
        throw new Error(
          `Connection not found for server ${validatedServerId}. Server may not be connected.`
        );
      }
      throw error;
    }
  }

  /**
   * Validate server ID format.
   * @private
   */
  private _validateServerId(serverId: string): string {
    if (!serverId || typeof serverId !== 'string') {
      throw new Error('Server ID must be a non-empty string');
    }

    // Accept both UUIDs and slugs (as per OpenAPI spec)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const slugRegex = /^[a-z0-9-]+$/;

    if (!uuidRegex.test(serverId) && !slugRegex.test(serverId)) {
      throw new Error(
        'Server ID must be a valid UUID or slug (lowercase letters, numbers, and hyphens only)'
      );
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
  public async ensureServerConnected(
    serverIdentifier: string,
    options: EnsureServerConnectedOptions = {}
  ): Promise<void> {
    const { pollSeconds = 60 } = options;

    if (!isNode) {
      throw new Error('ensureServerConnected requires Node.js environment for browser opening');
    }

    // 1. Locate server
    const servers = await this.listServers();
    const target = servers.find(
      s =>
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

    // 3. Open browser (shell-free)
    const platform = os.platform();

    // Validate URL scheme (require https, allow http only for localhost)
    let parsed: URL;
    try {
      parsed = new URL(authUrl);
    } catch {
      throw new Error('Invalid auth_url returned by server');
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
    } catch (error) {
      this._logger.warn('Failed to open browser', error);
    }

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
