/**
 * Main Barndoor SDK client.
 *
 * This module provides the primary BarndoorSDK class that mirrors the Python
 * SDK's client.py functionality with 100% API compatibility.
 */

import { HTTPClient, TimeoutConfig } from './http/client';
import { ServerSummary, ServerDetail } from './models';
import type {
  Channel,
  ChannelListResponse,
  ChannelOptions,
  ChannelTestResult,
  UpsertChannelInput,
  WebhookSecret,
} from './models';
import { HTTPError, ConfigurationError, TokenError, ServerNotFoundError } from './exceptions';
import { getStaticConfig, isNode } from './config';
import { getOidcConfig } from './auth';
import {
  ClientCredentialsParams,
  getClientCredentialsToken,
  _tokenNearExpiry,
} from './auth/clientCredentials';
import { createScopedLogger } from './logging';
import { spawn } from 'child_process';
import os from 'os';

/** Refresh M2M tokens this many seconds before their `exp` claim. */
const M2M_REFRESH_SKEW_SECONDS = 60;

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
 * Options for {@link BarndoorSDK.fromClientCredentials}.
 */
export interface FromClientCredentialsOptions extends ClientCredentialsParams {
  /** Request timeout in seconds for API calls (default: 30). */
  timeout?: number;
  /** Maximum number of retries for API calls (default: 3). */
  maxRetries?: number;
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
  /** Platform path for the public notification channel-management surface (BCP-3758). */
  private static readonly CHANNELS_PATH = '/api/notification/public/v1/channels';
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
  /** Cached client-credentials parameters for automatic token refresh. */
  private _credentials: ClientCredentialsParams | null = null;
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
   * Build a {@link BarndoorSDK} authenticated via the OAuth 2.0
   * client-credentials (machine-to-machine) grant.
   *
   * Performs the grant against the Barndoor auth server and returns a
   * ready-to-use SDK instance. The credentials are retained on the
   * instance so the access token can be refreshed automatically when it
   * nears expiry or when the API responds with 401.
   *
   * @example
   * ```ts
   * const sdk = await BarndoorSDK.fromClientCredentials(
   *   'https://api.barndoor.host',
   *   {
   *     clientId: process.env.BARNDOOR_M2M_CLIENT_ID!,
   *     clientSecret: process.env.BARNDOOR_M2M_CLIENT_SECRET!,
   *     audience: 'https://barndoor.ai/',
   *     issuer: 'https://auth.barndoor.ai/realms/barndoor',
   *   }
   * );
   * const servers = await sdk.listServers();
   * ```
   */
  public static async fromClientCredentials(
    apiBaseUrl: string,
    options: FromClientCredentialsOptions
  ): Promise<BarndoorSDK> {
    const { timeout, maxRetries, ...credentials } = options;

    const token = await getClientCredentialsToken(credentials);

    const sdkOptions: BarndoorSDKOptions = { token };
    if (timeout !== undefined) sdkOptions.timeout = timeout;
    if (maxRetries !== undefined) sdkOptions.maxRetries = maxRetries;

    const sdk = new BarndoorSDK(apiBaseUrl, sdkOptions);
    sdk._credentials = { ...credentials };
    // M2M tokens come from the auth server we just called — no need to
    // re-validate via the API on every request.
    sdk._tokenValidated = true;
    return sdk;
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
    await this._maybeRefreshM2MToken();

    const url = `${this.base}${path}`;
    const buildOptions = (): Record<string, unknown> => {
      const headers = { ...((options['headers'] as Record<string, string>) ?? {}) };
      headers['Authorization'] = `Bearer ${this.token}`;
      return { ...options, headers };
    };

    try {
      return await this._http.request(method, url, buildOptions());
    } catch (error: unknown) {
      // For M2M sessions, transparently refresh once on 401 and retry.
      if (error instanceof HTTPError && error.statusCode === 401 && this._credentials !== null) {
        this._logger.info('M2M token rejected (401); refreshing and retrying once');
        await this._refreshM2MToken();
        return await this._http.request(method, url, buildOptions());
      }
      throw error;
    }
  }

  /**
   * Refresh the M2M access token if it is near expiry.
   *
   * No-op for SDK instances not created via {@link BarndoorSDK.fromClientCredentials}.
   * @private
   */
  private async _maybeRefreshM2MToken(): Promise<void> {
    if (this._credentials === null) {
      return;
    }
    if (!_tokenNearExpiry(this.token, M2M_REFRESH_SKEW_SECONDS)) {
      return;
    }
    this._logger.debug('M2M token near expiry; refreshing');
    await this._refreshM2MToken();
  }

  /**
   * Unconditionally fetch a fresh M2M token using stored credentials.
   * @private
   */
  private async _refreshM2MToken(): Promise<void> {
    if (this._credentials === null) {
      throw new Error(
        '_refreshM2MToken() called on an SDK not created via BarndoorSDK.fromClientCredentials()'
      );
    }
    this._token = await getClientCredentialsToken(this._credentials);
    this._tokenValidated = true;
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
      // Use userinfo endpoint for validation (discovered via OIDC)
      const config = getStaticConfig();
      const oidcConfig = await getOidcConfig(config.authIssuer);
      const userinfoEndpoint = oidcConfig.userinfo_endpoint;

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await fetch(userinfoEndpoint, {
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
        const url = nextPage === 1 ? '/api/servers' : `/api/servers?page=${nextPage}`;
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
   * @param serverId - Server ID or slug
   * @returns Server details
   */
  public async getServer(serverId: string): Promise<ServerDetail> {
    const validatedServerId = this._validateServerId(serverId);

    this._logger.info(`Fetching server details for ${validatedServerId}`);
    // Use /api/servers/by-slug/{slug} for slugs, /api/servers/{uuid} for UUIDs
    const endpoint = this._isUuid(validatedServerId)
      ? `/api/servers/${validatedServerId}`
      : `/api/servers/by-slug/${validatedServerId}`;
    const response = await this._req('GET', endpoint);
    return ServerDetail.fromApiResponse(response);
  }

  /**
   * Initiate OAuth connection flow for a server.
   * @param serverId - Server ID or slug
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
      // Use /api/servers/by-slug/{slug} for slugs, /api/servers/{uuid} for UUIDs
      const endpoint = this._isUuid(validatedServerId)
        ? `/api/servers/${validatedServerId}/connect`
        : `/api/servers/by-slug/${validatedServerId}/connect`;
      const response = await this._req('POST', endpoint, {
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
   * @param serverId - Server ID or slug
   * @returns Connection status
   */
  public async getConnectionStatus(serverId: string): Promise<string> {
    const validatedServerId = this._validateServerId(serverId);

    this._logger.info(`Checking connection status for server ${validatedServerId}`);
    // Use /api/servers/by-slug/{slug} for slugs, /api/servers/{uuid} for UUIDs
    const endpoint = this._isUuid(validatedServerId)
      ? `/api/servers/${validatedServerId}/connection`
      : `/api/servers/by-slug/${validatedServerId}/connection`;
    const response = (await this._req('GET', endpoint)) as ConnectionStatusResponse;
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
      // Use /api/servers/by-slug/{slug} for slugs, /api/servers/{uuid} for UUIDs
      const endpoint = this._isUuid(validatedServerId)
        ? `/api/servers/${validatedServerId}/connection`
        : `/api/servers/by-slug/${validatedServerId}/connection`;
      await this._req('DELETE', endpoint);
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

  // ---------- Notification channels (public v1) -----------------
  //
  // Platform surface: /api/notification/public/v1/channels (BCP-3758). Every call is
  // organization-scoped from the caller's token — there is no organization parameter.

  /**
   * List the alert types this organization may subscribe a channel to.
   *
   * Read this before building a subscription set: the alert-type vocabulary grows over
   * time and is gated per organization, so this endpoint — not a hardcoded list — is the
   * authoritative answer to what `subscriptions` accepts. Subscribing to a type absent
   * here is accepted but never delivers.
   *
   * @returns The admitted alert types, plus the category and severity vocabularies
   */
  public async getChannelOptions(): Promise<ChannelOptions> {
    this._logger.debug('Fetching notification channel options');
    return (await this._req('GET', `${BarndoorSDK.CHANNELS_PATH}/options`)) as ChannelOptions;
  }

  /**
   * List the organization's shared notification channels.
   *
   * Returns the organization-wide channels — `email`, `webhook`, `slack`, `teams` — with
   * their current subscription sets. Personal channels are not included; use
   * {@link listUserChannels} for those.
   *
   * @returns The organization's shared channels, in no guaranteed order
   */
  public async listChannels(): Promise<Channel[]> {
    this._logger.debug('Listing organization notification channels');
    const response = (await this._req('GET', BarndoorSDK.CHANNELS_PATH)) as ChannelListResponse;
    return response?.data ?? [];
  }

  /**
   * List the caller's own personal notification channels.
   *
   * Returns the authenticated caller's `in_app` and `user_email` channels. Always
   * self-scoped — there is no way to read another user's personal channels.
   *
   * @returns The caller's personal channels
   */
  public async listUserChannels(): Promise<Channel[]> {
    this._logger.debug("Listing caller's personal notification channels");
    const response = (await this._req(
      'GET',
      `${BarndoorSDK.CHANNELS_PATH}/user`
    )) as ChannelListResponse;
    return response?.data ?? [];
  }

  /**
   * Create or update a notification channel and replace its subscriptions.
   *
   * This is a full upsert, not a patch: `subscriptions` **replaces** the channel's
   * existing set, so omitting it removes every subscription the channel had. Send the
   * complete desired set on every call.
   *
   * Without `channelId` the channel is keyed on its type's natural identity, so repeating
   * an identical call is idempotent rather than creating duplicates: `email` by address,
   * `webhook` by URL, `slack` by channel id, and the personal types by (organization,
   * type, caller). With `channelId` it is an authoritative edit of that row — the only way
   * to update a `teams` channel, whose natural identity is a secret URL.
   *
   * Which destination fields are permitted depends on `type`; sending one that does not
   * belong throws {@link HTTPError} with status 422 rather than being silently ignored.
   *
   * @param input - Channel definition; see {@link UpsertChannelInput}
   * @returns The created or updated channel. When this call *creates* a `webhook`
   *   channel, `signing_secret` carries the one-time reveal — store it. A retried create
   *   that lands after the first attempt already succeeded returns a null
   *   `signing_secret` rather than a second secret; use {@link regenerateChannelSecret}
   *   if you need one.
   */
  public async upsertChannel(input: UpsertChannelInput): Promise<Channel> {
    if (!input || typeof input !== 'object') {
      throw new Error('Channel input must be a non-empty object');
    }
    if (!input.type || typeof input.type !== 'string') {
      throw new Error('Channel type must be a non-empty string');
    }

    const body: Record<string, unknown> = {
      type: input.type,
      enabled: input.enabled ?? true,
    };
    if (input.channelId !== undefined) {
      body['id'] = this._requireChannelId(input.channelId);
    }
    // Only forward destination fields the caller actually supplied: padding the body with
    // nulls for the other types' fields is a 422 server-side.
    const optional: Array<[string, string | undefined]> = [
      ['email_address', input.emailAddress],
      ['url', input.url],
      ['label', input.label],
      ['slack_channel_id', input.slackChannelId],
      ['teams_workflow_url', input.teamsWorkflowUrl],
    ];
    for (const [key, value] of optional) {
      if (value !== undefined) {
        body[key] = value;
      }
    }
    // Always send the key: an omitted list and an empty list mean the same thing to this
    // endpoint (unsubscribe from everything), and being explicit keeps that destructive
    // default visible on the wire.
    body['subscriptions'] = (input.subscriptions ?? []).map(alertType => ({
      alert_type: alertType,
    }));

    this._logger.info(`Upserting notification channel (type=${input.type})`);
    return (await this._req('PUT', BarndoorSDK.CHANNELS_PATH, { json: body })) as Channel;
  }

  /**
   * Delete a notification channel.
   *
   * Its subscriptions cascade and any stored secret is removed. Irreversible — to stop
   * delivery reversibly, call {@link upsertChannel} with `enabled: false`.
   *
   * @param channelId - Unique identifier of the channel to delete
   * @throws {HTTPError} With status 404 when no such channel exists in the caller's org
   */
  public async deleteChannel(channelId: string): Promise<void> {
    const id = this._requireChannelId(channelId);
    this._logger.info(`Deleting notification channel ${id}`);
    await this._req('DELETE', `${BarndoorSDK.CHANNELS_PATH}/${id}`);
  }

  /**
   * Rotate a webhook channel's signing secret.
   *
   * Returns the new secret once. The previous secret stops verifying immediately, so
   * deploy the new one to your receiver before the next alert fires. There is no endpoint
   * that reads the current secret, so this is also the recovery path when a secret from
   * channel creation was lost.
   *
   * @param channelId - Unique identifier of the webhook channel
   * @returns The new signing secret
   */
  public async regenerateChannelSecret(channelId: string): Promise<WebhookSecret> {
    const id = this._requireChannelId(channelId);
    this._logger.info(`Rotating signing secret for notification channel ${id}`);
    return (await this._req(
      'POST',
      `${BarndoorSDK.CHANNELS_PATH}/${id}/regenerate-secret`
    )) as WebhookSecret;
  }

  /**
   * Send a connectivity-test message through a channel's real transport.
   *
   * Lets you verify a webhook receiver, email address, Slack channel, or Teams workflow
   * actually works. It is not an alert: nothing is persisted, no other channel is
   * notified, and it ignores the channel's subscriptions.
   *
   * A transport failure comes back as `ok: false` with a reason, not as a thrown error —
   * the request succeeded, the delivery did not.
   *
   * @param channelId - Unique identifier of the channel to test
   * @returns Whether the message reached the transport, and why not if it did not
   */
  public async testChannel(channelId: string): Promise<ChannelTestResult> {
    const id = this._requireChannelId(channelId);
    this._logger.debug(`Testing notification channel ${id}`);
    return (await this._req(
      'POST',
      `${BarndoorSDK.CHANNELS_PATH}/${id}/test`
    )) as ChannelTestResult;
  }

  /** Validate and normalize a channel id shared by the by-id channel methods. */
  private _requireChannelId(channelId: string): string {
    if (!channelId || typeof channelId !== 'string') {
      throw new Error('Channel ID must be a non-empty string');
    }
    const trimmed = channelId.trim();
    if (!trimmed) {
      throw new Error('Channel ID cannot be empty or whitespace');
    }
    return trimmed;
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
   * Check if serverId is a UUID or slug.
   * @private
   */
  private _isUuid(serverId: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(serverId);
  }

  // ---------- Policy management (V2 ACC APIs) -----------------

  /**
   * List policies with pagination and filtering.
   * @param page - Page number for pagination (default: 1)
   * @param limit - Number of items per page (default: 10)
   * @param filters - Additional query parameters for filtering
   * @returns Paginated response containing policies
   */
  public async listPolicies(page = 1, limit = 10, filters: Record<string, any> = {}): Promise<any> {
    if (!Number.isInteger(page) || page < 1) {
      throw new Error('Page must be a positive integer');
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new Error('Limit must be a positive integer between 1 and 1000');
    }

    this._logger.debug(`Listing policies (page=${page}, limit=${limit})`);
    const params = { page, limit, ...filters };
    return this._req('GET', '/api/v2/policies', { params });
  }

  /**
   * Get detailed information about a specific policy.
   * @param policyId - Unique identifier of the policy
   * @returns Policy details
   */
  public async getPolicy(policyId: string): Promise<any> {
    if (!policyId || typeof policyId !== 'string') {
      throw new Error('Policy ID must be a non-empty string');
    }
    if (!this._isUuid(policyId)) {
      throw new Error('Policy ID must be a valid UUID');
    }

    this._logger.debug(`Fetching policy details for ${policyId}`);
    return this._req('GET', `/api/v2/policies/${policyId}`);
  }

  /**
   * Create a new policy.
   * @param policyData - Policy configuration data
   * @returns Created policy details
   */
  public async createPolicy(policyData: any): Promise<any> {
    if (!policyData || typeof policyData !== 'object') {
      throw new Error('Policy data must be a non-empty object');
    }

    this._logger.debug('Creating new policy');
    return this._req('POST', '/api/v2/policies', { json: policyData });
  }

  /**
   * Update an existing policy.
   * @param policyId - Unique identifier of the policy to update
   * @param policyData - Updated policy configuration data
   * @returns Updated policy details
   */
  public async updatePolicy(policyId: string, policyData: any): Promise<any> {
    if (!policyId || typeof policyId !== 'string') {
      throw new Error('Policy ID must be a non-empty string');
    }
    if (!this._isUuid(policyId)) {
      throw new Error('Policy ID must be a valid UUID');
    }
    if (!policyData || typeof policyData !== 'object') {
      throw new Error('Policy data must be a non-empty object');
    }

    this._logger.debug(`Updating policy ${policyId}`);
    return this._req('PATCH', `/api/v2/policies/${policyId}`, { json: policyData });
  }

  /**
   * Clone an existing policy.
   * @param policyId - Unique identifier of the policy to clone
   * @param newName - Name for the cloned policy
   * @returns Cloned policy details
   */
  public async clonePolicy(policyId: string, newName: string): Promise<any> {
    if (!policyId || typeof policyId !== 'string') {
      throw new Error('Policy ID must be a non-empty string');
    }
    if (!this._isUuid(policyId)) {
      throw new Error('Policy ID must be a valid UUID');
    }
    if (!newName || typeof newName !== 'string') {
      throw new Error('New name must be a non-empty string');
    }

    this._logger.debug(`Cloning policy ${policyId} with new name: ${newName}`);
    return this._req('POST', `/api/v2/policies/${policyId}/clone`, { json: { name: newName } });
  }

  /**
   * Validate policy configuration.
   * @param validationData - Policy data to validate
   * @returns Validation result
   */
  public async validatePolicy(validationData: any): Promise<any> {
    if (!validationData || typeof validationData !== 'object') {
      throw new Error('Validation data must be a non-empty object');
    }

    this._logger.debug('Validating policy configuration');
    return this._req('POST', '/api/v2/policies/validate', { json: validationData });
  }

  /**
   * Get summary of all policies.
   * @returns Policy summary information
   */
  public async getPolicySummary(): Promise<any> {
    this._logger.debug('Fetching policy summary');
    return this._req('GET', '/api/v2/policies/summary');
  }

  /**
   * Get available filter definitions for policies.
   * @returns Available filter categories and options
   */
  public async getPolicyFilterDefinitions(): Promise<any> {
    this._logger.debug('Fetching policy filter definitions');
    return this._req('GET', '/api/v2/policies/filter-definitions');
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

    // 1. Locate server using getServer (handles both slugs and UUIDs)
    let target: ServerDetail;
    try {
      target = await this.getServer(serverIdentifier);
    } catch (error: unknown) {
      if (error instanceof HTTPError && error.statusCode === 404) {
        throw new ServerNotFoundError(serverIdentifier);
      }
      throw error;
    }

    if (target.connection_status === 'connected') {
      return; // Already connected
    }

    // 2. Start OAuth flow - use slug for connection (MCP endpoint expects slugs)
    const connectionIdentifier = target.slug || serverIdentifier;
    const connection = await this.initiateConnection(connectionIdentifier);
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
      const status = await this.getConnectionStatus(connectionIdentifier);
      if (status === 'connected') {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('OAuth connection was not completed in time');
  }
}
