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
