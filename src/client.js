/**
 * Main Barndoor SDK client.
 * 
 * This module provides the primary BarndoorSDK class that mirrors the Python
 * SDK's client.py functionality with 100% API compatibility.
 */

import { HTTPClient, TimeoutConfig } from './http/client.js';
import { loadUserToken } from './auth/index.js';
import { ServerSummary, ServerDetail } from './models/index.js';
import {
  BarndoorError,
  HTTPError,
  ConnectionError,
  ConfigurationError,
  TokenError,
  ServerNotFoundError
} from './exceptions/index.js';
import { getStaticConfig, getDynamicConfig, isNode } from './config.js';
import { exec } from 'child_process';
import os from 'os';

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
  /**
   * @param {string} apiBaseUrl - Base URL of the Barndoor API
   * @param {Object} [options={}] - Configuration options
   * @param {string} [options.token] - User JWT token
   * @param {boolean} [options.validateTokenOnInit=true] - Whether to validate token on init
   * @param {number} [options.timeout=30.0] - Request timeout in seconds
   * @param {number} [options.maxRetries=3] - Maximum number of retries
   */
  constructor(apiBaseUrl, options = {}) {
    const {
      token: barndoorToken,
      validateTokenOnInit = true,
      timeout = 30.0,
      maxRetries = 3
    } = options;
    
    // Validate inputs
    this.base = this._validateUrl(apiBaseUrl, 'API base URL').replace(/\/$/, '');
    
    // Get token from parameter or storage
    const token = barndoorToken || loadUserToken();
    if (!token) {
      throw new Error(
        'Barndoor user token not provided and none found in store. Run `barndoor-login`.'
      );
    }
    this.token = this._validateToken(token);
    
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
    
    console.log(`Initialized BarndoorSDK for ${this.base}`);
  }
  
  /**
   * Validate URL format.
   * @private
   */
  _validateUrl(url, name) {
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
  _validateToken(token) {
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
  _ensureNotClosed() {
    if (this._closed) {
      throw new Error('SDK has been closed. Create a new instance or use as context manager.');
    }
  }
  
  /**
   * Make authenticated request with automatic token validation.
   * @private
   */
  async _req(method, path, options = {}) {
    this._ensureNotClosed();
    await this.ensureValidToken();
    
    const headers = options.headers || {};
    headers['Authorization'] = `Bearer ${this.token}`;
    
    const url = `${this.base}${path}`;
    return await this._http.request(method, url, { ...options, headers });
  }
  
  /**
   * Validate the cached token by making a test API call.
   * @returns {Promise<boolean>} True if the token is valid
   */
  async validateCachedToken() {
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
  async ensureValidToken() {
    if (this._tokenValidated) {
      return;
    }
    
    // Skip validation in non-production environments
    const env = (isNode ? process.env.BARNDOOR_ENV : '') || 'localdev';
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
   * @returns {Promise<ServerSummary[]>} Array of server summaries
   */
  async listServers() {
    console.log('Fetching server list');
    try {
      const response = await this._req('GET', '/servers');
      const servers = response.map(data => ServerSummary.fromApiResponse(data));
      console.log(`Retrieved ${servers.length} servers`);
      return servers;
    } catch (error) {
      console.error('Failed to list servers:', error);
      throw error;
    }
  }
  
  /**
   * Get detailed information about a specific server.
   * @param {string} serverId - Server ID
   * @returns {Promise<ServerDetail>} Server details
   */
  async getServer(serverId) {
    const validatedServerId = this._validateServerId(serverId);
    
    console.log(`Fetching server details for ${validatedServerId}`);
    const response = await this._req('GET', `/servers/${validatedServerId}`);
    return ServerDetail.fromApiResponse(response);
  }
  
  /**
   * Initiate OAuth connection flow for a server.
   * @param {string} serverId - Server ID
   * @param {string} [returnUrl] - Optional return URL
   * @returns {Promise<Object>} Connection initiation response
   */
  async initiateConnection(serverId, returnUrl = null) {
    const validatedServerId = this._validateServerId(serverId);
    let validatedReturnUrl = null;
    
    if (returnUrl) {
      validatedReturnUrl = this._validateUrl(returnUrl, 'Return URL');
    }
    
    console.log(`Initiating connection for server ${validatedServerId}`);
    
    const params = validatedReturnUrl ? { return_url: validatedReturnUrl } : undefined;
    
    try {
      const response = await this._req('POST', `/servers/${validatedServerId}/connect`, {
        params,
        json: {}
      });
      return response;
    } catch (error) {
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
   * @param {string} serverId - Server ID
   * @returns {Promise<string>} Connection status
   */
  async getConnectionStatus(serverId) {
    const validatedServerId = this._validateServerId(serverId);
    
    console.log(`Checking connection status for server ${validatedServerId}`);
    const response = await this._req('GET', `/servers/${validatedServerId}/connection`);
    return response.status;
  }
  
  /**
   * Validate server ID format.
   * @private
   */
  _validateServerId(serverId) {
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
  async close() {
    if (!this._closed) {
      await this._http.close();
      this._closed = true;
    }
  }
  
  /**
   * Alias for close() to match Python SDK naming.
   */
  async aclose() {
    await this.close();
  }

  /**
   * Ensure a server is connected, initiating OAuth if needed.
   * @param {string} serverIdentifier - Server slug or provider name
   * @param {Object} [options={}] - Options
   * @param {number} [options.pollSeconds=60] - Maximum seconds to wait
   */
  async ensureServerConnected(serverIdentifier, options = {}) {
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
