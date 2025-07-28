/**
 * Token storage and management.
 * 
 * This module provides token storage that works in both browser and Node.js
 * environments, mirroring the Python SDK's auth_store functionality.
 */

import { isBrowser, isNode } from '../config.js';
import { TokenError, TokenExpiredError } from '../exceptions/index.js';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

/**
 * Abstract base class for token storage.
 */
class TokenStorage {
  async loadToken() {
    throw new Error('loadToken must be implemented by subclass');
  }
  
  async saveToken(tokenData) {
    throw new Error('saveToken must be implemented by subclass');
  }
  
  async clearToken() {
    throw new Error('clearToken must be implemented by subclass');
  }
}

/**
 * Browser-based token storage using localStorage.
 */
class BrowserTokenStorage extends TokenStorage {
  constructor() {
    super();
    this.storageKey = 'barndoor_token';
  }
  
  async loadToken() {
    try {
      const tokenData = localStorage.getItem(this.storageKey);
      return tokenData ? JSON.parse(tokenData) : null;
    } catch (error) {
      console.warn('Failed to load token from localStorage:', error);
      return null;
    }
  }
  
  async saveToken(tokenData) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(tokenData));
    } catch (error) {
      throw new TokenError(`Failed to save token: ${error.message}`);
    }
  }
  
  async clearToken() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn('Failed to clear token from localStorage:', error);
    }
  }
}

/**
 * Node.js-based token storage using file system.
 */
class NodeTokenStorage extends TokenStorage {
  constructor() {
    super();
    this.tokenFile = this._getTokenFilePath();
  }
  
  _getTokenFilePath() {
    if (isNode) {
      return path.join(os.homedir(), '.barndoor', 'token.json');
    }
    throw new Error('NodeTokenStorage can only be used in Node.js environment');
  }
  
  async loadToken() {
    if (!isNode) {
      throw new Error('NodeTokenStorage can only be used in Node.js environment');
    }
    
    try {
      const tokenData = await fs.readFile(this.tokenFile, 'utf8');
      return JSON.parse(tokenData);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // File doesn't exist
      }
      console.warn('Failed to load token from file:', error);
      return null;
    }
  }
  
  async saveToken(tokenData) {
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
      throw new TokenError(`Failed to save token: ${error.message}`);
    }
  }
  
  async clearToken() {
    if (!isNode) {
      throw new Error('NodeTokenStorage can only be used in Node.js environment');
    }
    
    try {
      await fs.unlink(this.tokenFile);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('Failed to clear token file:', error);
      }
    }
  }
}

/**
 * Get the appropriate token storage for the current environment.
 * @returns {TokenStorage}
 */
export function getTokenStorage() {
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
  constructor(apiBaseUrl) {
    this.apiBaseUrl = apiBaseUrl.replace(/\/$/, '');
    this.storage = getTokenStorage();
  }
  
  /**
   * Get a valid token, refreshing if necessary.
   * @returns {Promise<string>} Valid access token
   */
  async getValidToken() {
    const tokenData = await this.storage.loadToken();
    
    if (!tokenData) {
      throw new TokenError('No token found. Please authenticate.');
    }
    
    try {
      const validatedTokenData = await this._validateOrRefresh(tokenData);
      await this.storage.saveToken(validatedTokenData);
      return validatedTokenData.access_token;
    } catch (error) {
      console.error('Token validation/refresh failed:', error);
      throw new TokenExpiredError('Token expired and refresh failed. Please re-authenticate.');
    }
  }
  
  /**
   * Validate token or refresh if needed.
   * @private
   */
  async _validateOrRefresh(tokenData) {
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
  _isTokenValidLocally(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return false;
      }
      
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      const now = Math.floor(Date.now() / 1000);
      
      return payload.exp && payload.exp > now;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Validate token remotely using Auth0's userinfo endpoint.
   * @private
   */
  async _isTokenValidRemote(token) {
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
  async _refreshToken(tokenData) {
    // This would need to be implemented based on the OAuth provider's refresh endpoint
    // For now, throw an error to indicate refresh is not yet implemented
    throw new Error('Token refresh not yet implemented in JavaScript SDK');
  }
}

// Legacy functions for backward compatibility

/**
 * Load user token from storage.
 * @returns {Promise<string|null>}
 */
export async function loadUserToken() {
  try {
    const storage = getTokenStorage();
    const tokenData = await storage.loadToken();
    return tokenData?.access_token || null;
  } catch (error) {
    return null;
  }
}

/**
 * Save user token to storage.
 * @param {string|Object} token - Token string or token data object
 */
export async function saveUserToken(token) {
  const storage = getTokenStorage();
  
  let tokenData;
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
export async function clearCachedToken() {
  const storage = getTokenStorage();
  await storage.clearToken();
}
