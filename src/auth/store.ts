/**
 * Token storage and management.
 *
 * This module provides token storage that works in both browser and Node.js
 * environments, mirroring the Python SDK's auth_store functionality.
 */

import { isBrowser, isNode, getStaticConfig } from '../config';
import { TokenError, TokenExpiredError } from '../exceptions';
import { createScopedLogger, Logger } from '../logging';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { jwtVerify, createRemoteJWKSet } from 'jose';

// Create scoped logger for token management
const _logger = createScopedLogger('token');

/**
 * OIDC configuration from discovery endpoint.
 */
export interface OidcConfig {
  issuer: string;
  token_endpoint: string;
  authorization_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  [key: string]: unknown;
}

// Cache for OIDC discovery results
const _oidcConfigCache = new Map<string, OidcConfig>();

/**
 * Fetch and cache OIDC configuration from the issuer's discovery endpoint.
 *
 * @param issuer - The OIDC issuer URL (e.g., https://auth.barndoor.ai or
 *                 https://auth.barndoor.ai/realms/barndoor)
 * @returns OIDC configuration containing endpoints like token_endpoint, jwks_uri, etc.
 */
export async function getOidcConfig(issuer: string): Promise<OidcConfig> {
  // Check cache first
  if (_oidcConfigCache.has(issuer)) {
    return _oidcConfigCache.get(issuer)!;
  }

  // Normalize issuer URL
  const normalizedIssuer = issuer.replace(/\/$/, '');
  const discoveryUrl = `${normalizedIssuer}/.well-known/openid-configuration`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(discoveryUrl, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const config = (await response.json()) as OidcConfig;
      _oidcConfigCache.set(issuer, config);
      _logger.debug(`OIDC discovery successful for ${issuer}`);
      return config;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    _logger.warn(`OIDC discovery failed for ${issuer}:`, error);
    // Return minimal fallback config using RFC 8414 / OpenID Connect standard paths.
    // Keycloak, Auth0, and most OIDC providers support these.
    if (normalizedIssuer.includes('/realms/')) {
      // Keycloak-style issuer — use protocol endpoint paths
      return {
        issuer: normalizedIssuer,
        token_endpoint: `${normalizedIssuer}/protocol/openid-connect/token`,
        authorization_endpoint: `${normalizedIssuer}/protocol/openid-connect/auth`,
        userinfo_endpoint: `${normalizedIssuer}/protocol/openid-connect/userinfo`,
        jwks_uri: `${normalizedIssuer}/protocol/openid-connect/certs`,
      };
    } else {
      // Auth0/generic OIDC provider — use standard paths
      return {
        issuer: normalizedIssuer,
        token_endpoint: `${normalizedIssuer}/oauth/token`,
        authorization_endpoint: `${normalizedIssuer}/authorize`,
        userinfo_endpoint: `${normalizedIssuer}/userinfo`,
        jwks_uri: `${normalizedIssuer}/.well-known/jwks.json`,
      };
    }
  }
}

/**
 * Clear the OIDC config cache (useful for testing).
 */
export function clearOidcConfigCache(): void {
  _oidcConfigCache.clear();
}

/**
 * Set a custom logger for the token management module.
 * @deprecated Use setLogger from the main logging module instead
 */
export function setTokenLogger(_logger: Logger): void {
  // This is now deprecated - users should use the main setLogger function
  console.warn('setTokenLogger is deprecated. Use setLogger from the main logging module instead.');
}

/**
 * Cross-platform base64url decode function.
 */
function base64UrlDecode(str: string): string {
  // Replace URL-safe characters
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');

  if (isNode) {
    return Buffer.from(base64, 'base64').toString('utf8');
  } else if (typeof globalThis !== 'undefined' && globalThis.atob) {
    return globalThis.atob(base64);
  } else {
    throw new Error('No base64 decode function available');
  }
}

/**
 * Safely decode JWT payload.
 */
function decodeJwtPayload(token: string): { exp?: number; [key: string]: unknown } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(parts[1]!));
    return payload as { exp?: number; [key: string]: unknown };
  } catch (_error) {
    return null;
  }
}

/**
 * Add timeout to fetch operations for environments that don't support AbortSignal.timeout.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  // Try to use AbortSignal.timeout if available
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return promise;
  }

  // Fallback timeout implementation
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
    }),
  ]);
}

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
 * JWT verification result.
 */
export enum JWTVerificationResult {
  VALID = 'valid',
  EXPIRED = 'expired',
  INVALID = 'invalid',
}

// Singleton JWKS instances to avoid recreating on every call
const _jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/**
 * Get or create a JWKS instance for the given issuer using OIDC discovery.
 */
async function getJWKS(issuer: string): Promise<ReturnType<typeof createRemoteJWKSet>> {
  if (_jwksCache.has(issuer)) {
    return _jwksCache.get(issuer)!;
  }

  try {
    const oidcConfig = await getOidcConfig(issuer);
    const jwksUri = oidcConfig.jwks_uri;
    if (!jwksUri) {
      _logger.debug(`No jwks_uri in OIDC config for ${issuer}`);
      throw new Error('No jwks_uri available');
    }

    const jwks = createRemoteJWKSet(new URL(jwksUri));
    _jwksCache.set(issuer, jwks);
    return jwks;
  } catch (error) {
    _logger.debug(`Failed to get JWKS for ${issuer}:`, error);
    throw error;
  }
}

/**
 * Simple file locking context manager for cross-platform compatibility.
 */
class _FileLock {
  private readonly lockFile: string;
  private lockAcquired: boolean = false;

  constructor(filePath: string) {
    this.lockFile = `${filePath}.lock`;
  }

  /**
   * Acquire file lock with timeout.
   */
  async acquire(timeoutMs: number = 5000): Promise<void> {
    if (!isNode) {
      return; // No locking needed in browser
    }

    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        // Try to create lock file exclusively
        await fs.writeFile(this.lockFile, process.pid.toString(), { flag: 'wx' });
        this.lockAcquired = true;
        return;
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
          // Lock file exists, check if process is still alive
          try {
            const pidStr = await fs.readFile(this.lockFile, 'utf8');
            const pid = parseInt(pidStr.trim(), 10);

            // Check if process is still running
            try {
              process.kill(pid, 0); // Signal 0 just checks if process exists
              // Process exists, wait and retry
              await new Promise(resolve => setTimeout(resolve, 100));
              continue;
            } catch (error: unknown) {
              // Handle different error types
              if (error && typeof error === 'object' && 'code' in error) {
                const nodeError = error as { code: string };
                if (nodeError.code === 'EPERM') {
                  // On Windows, EPERM means process exists but we can't signal it
                  // (different user/permissions) - treat as process still running
                  await new Promise(resolve => setTimeout(resolve, 100));
                  continue;
                } else if (nodeError.code === 'ESRCH') {
                  // Process doesn't exist, remove stale lock
                  await fs.unlink(this.lockFile).catch(() => {});
                  continue;
                }
              }
              // For any other error, assume process doesn't exist
              await fs.unlink(this.lockFile).catch(() => {});
              continue;
            }
          } catch {
            // Can't read lock file, try to remove it
            await fs.unlink(this.lockFile).catch(() => {});
            continue;
          }
        } else {
          throw new TokenError(`Failed to acquire file lock: ${error}`);
        }
      }
    }

    throw new TokenError('Failed to acquire file lock: timeout');
  }

  /**
   * Release file lock.
   */
  async release(): Promise<void> {
    if (!isNode || !this.lockAcquired) {
      return;
    }

    try {
      await fs.unlink(this.lockFile);
      this.lockAcquired = false;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.debug('Failed to release file lock:', error);
      // Don't throw - cleanup is best effort
    }
  }
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
      return tokenData ? (JSON.parse(tokenData) as TokenData) : null;
    } catch (error) {
      _logger.warn('Failed to load token from localStorage:', error);
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
      _logger.warn('Failed to clear token from localStorage:', error);
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

    const lock = new _FileLock(this.tokenFile);

    try {
      // Acquire file lock to prevent reading during writes
      await lock.acquire();

      const tokenData = await fs.readFile(this.tokenFile, 'utf8');
      return JSON.parse(tokenData) as TokenData;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return null; // File doesn't exist
      }
      _logger.warn('Failed to load token from file:', error);
      return null;
    } finally {
      await lock.release();
    }
  }

  public async saveToken(tokenData: TokenData): Promise<void> {
    if (!isNode) {
      throw new Error('NodeTokenStorage can only be used in Node.js environment');
    }

    const lock = new _FileLock(this.tokenFile);

    try {
      // Acquire file lock to prevent race conditions
      await lock.acquire();

      // Ensure directory exists
      await fs.mkdir(path.dirname(this.tokenFile), { recursive: true });

      // Write token file with restrictive permissions
      await fs.writeFile(this.tokenFile, JSON.stringify(tokenData, null, 2));
      await fs.chmod(this.tokenFile, 0o600);

      _logger.debug('Token saved to storage');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new TokenError(`Failed to save token: ${errorMessage}`);
    } finally {
      await lock.release();
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
        _logger.warn('Failed to clear token file:', error);
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
 * Verify JWT locally using JWKS.
 * @param token - JWT token to verify
 * @param issuer - OIDC issuer URL (e.g., https://auth.barndoor.ai)
 * @param audience - Expected audience
 * @returns Verification result
 */
export async function verifyJWTLocal(
  token: string,
  issuer: string,
  audience: string
): Promise<JWTVerificationResult> {
  try {
    const JWKS = await getJWKS(issuer);

    // Normalize issuer for comparison (with trailing slash)
    const expectedIssuer = `${issuer.replace(/\/$/, '')}/`;

    await jwtVerify(token, JWKS, {
      issuer: expectedIssuer,
      audience,
    });

    _logger.debug('Token verified locally using JWKS');
    return JWTVerificationResult.VALID;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'ERR_JWT_EXPIRED') {
        _logger.debug('Token expired (verified locally)');
        return JWTVerificationResult.EXPIRED;
      }
    }
    _logger.debug('JWT verification failed:', error);
    return JWTVerificationResult.INVALID;
  }
}

/**
 * Simple in-memory mutex for preventing concurrent operations.
 */
class Mutex {
  private _locked = false;
  private _waitQueue: Array<() => void> = [];

  async acquire(): Promise<void> {
    return new Promise<void>(resolve => {
      if (!this._locked) {
        this._locked = true;
        resolve();
      } else {
        this._waitQueue.push(resolve);
      }
    });
  }

  release(): void {
    if (this._waitQueue.length > 0) {
      const next = this._waitQueue.shift();
      if (next) {
        next();
      }
    } else {
      this._locked = false;
    }
  }

  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

/**
 * Token manager that handles storage, validation, and refresh.
 */
export class TokenManager {
  /** Token storage instance */
  private readonly storage: TokenStorage;
  /** Mutex to prevent concurrent refresh operations */
  private readonly _refreshMutex = new Mutex();

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
    return this._refreshMutex.withLock(async () => {
      // Re-load token inside the lock in case another thread refreshed it
      const tokenData = await this.storage.loadToken();

      if (!tokenData) {
        throw new TokenError('No token found. Please authenticate.');
      }

      try {
        // Check if we should proactively refresh the token
        if (this._shouldRefreshToken(tokenData) && tokenData.refresh_token) {
          _logger.debug('Proactively refreshing token before expiration');
          const newTokenData = await this._refreshToken(tokenData);
          const updatedTokenData = { ...tokenData, ...newTokenData };
          await this.storage.saveToken(updatedTokenData);
          return updatedTokenData.access_token;
        }

        // Otherwise, validate or refresh as needed
        const validatedTokenData = await this._validateOrRefresh(tokenData);
        await this.storage.saveToken(validatedTokenData);
        return validatedTokenData.access_token;
      } catch (error) {
        _logger.error('Token validation/refresh failed:', error);
        throw new TokenExpiredError('Token expired and refresh failed. Please re-authenticate.');
      }
    });
  }

  /**
   * Check if token should be refreshed proactively.
   * @private
   */
  private _shouldRefreshToken(tokenData: TokenData): boolean {
    const payload = decodeJwtPayload(tokenData.access_token);
    if (!payload?.exp) {
      return true; // Refresh if we can't parse the token or no expiration
    }

    // Refresh if token expires within 5 minutes (300 seconds)
    const now = Math.floor(Date.now() / 1000);
    return payload.exp - now < 300;
  }

  /**
   * Validate token using fast-path local verification with remote fallback.
   * @private
   */
  private async _validateOrRefresh(tokenData: TokenData): Promise<TokenData> {
    const accessToken = tokenData.access_token;
    const cfg = getStaticConfig();

    // Fast path: local JWT verification
    const jwtValid = await verifyJWTLocal(accessToken, cfg.authIssuer, cfg.apiAudience);

    if (jwtValid === JWTVerificationResult.VALID) {
      _logger.debug('Token validated locally');
      return tokenData; // verified locally
    }

    if (jwtValid === JWTVerificationResult.INVALID) {
      // Couldn't verify locally, try remote validation
      _logger.debug('Local validation failed, trying remote');
      if (await this._isTokenValidRemote(accessToken)) {
        _logger.debug('Token validated remotely');
        return tokenData;
      }
    }

    // Token is invalid or expired - attempt refresh
    _logger.info('Token invalid or expired, attempting refresh');
    if (tokenData.refresh_token) {
      const newTokenData = await this._refreshToken(tokenData);
      // Merge the new token data (may include rotated refresh_token) with existing data
      return { ...tokenData, ...newTokenData };
    }

    throw new TokenExpiredError('Token expired and no refresh token available');
  }

  /**
   * Validate token remotely using userinfo endpoint (discovered via OIDC).
   * @private
   */
  private async _isTokenValidRemote(token: string): Promise<boolean> {
    try {
      const cfg = getStaticConfig();
      const oidcConfig = await getOidcConfig(cfg.authIssuer);
      const userinfoEndpoint = oidcConfig.userinfo_endpoint;

      const fetchPromise = fetch(userinfoEndpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        ...(typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
          ? { signal: AbortSignal.timeout(5000) }
          : {}),
      });

      const response = await withTimeout(fetchPromise, 5000);
      return response.ok;
    } catch (error) {
      _logger.debug('Remote token validation failed:', error);
      return false;
    }
  }

  /**
   * Refresh the access token using the refresh token.
   * @private
   */
  private async _refreshToken(tokenData: TokenData): Promise<Partial<TokenData>> {
    const refreshToken = tokenData.refresh_token;
    if (!refreshToken) {
      throw new TokenError('No refresh token available');
    }

    const cfg = getStaticConfig();

    // Browser security: don't expose client_secret in browser environments
    if (isBrowser && cfg.clientSecret) {
      throw new TokenError(
        'Refresh flow requires a confidential client; run interactive login again.'
      );
    }

    // Get token endpoint from OIDC discovery
    const oidcConfig = await getOidcConfig(cfg.authIssuer);
    const tokenEndpoint = oidcConfig.token_endpoint;

    const payload = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: cfg.clientId,
      refresh_token: refreshToken,
    });

    // Only add client_secret if we have one and we're not in browser
    if (cfg.clientSecret && !isBrowser) {
      payload.set('client_secret', cfg.clientSecret);
    }

    try {
      const fetchPromise = fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload.toString(),
        ...(typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
          ? { signal: AbortSignal.timeout(15000) }
          : {}),
      });

      const response = await withTimeout(fetchPromise, 15000);

      if (response.status === 400) {
        // Bad request - likely invalid refresh token
        let errorDesc = 'Invalid refresh token';
        try {
          const errorData = await response.json();
          errorDesc = errorData.error_description || errorDesc;
        } catch {
          // Ignore JSON parse errors
        }
        _logger.warn(`Refresh token invalid: ${errorDesc}`);
        throw new TokenExpiredError(`Refresh token expired or invalid: ${errorDesc}`);
      } else if (response.status === 429) {
        // Rate limited - should implement backoff
        _logger.warn('Rate limited during token refresh');
        throw new TokenError('Rate limited during token refresh. Please try again later.');
      } else if (response.status >= 500) {
        // Server error - temporary issue
        _logger.warn(`Auth server error during refresh: ${response.status}`);
        throw new TokenError(`Auth server temporarily unavailable (HTTP ${response.status})`);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const newTokenData = await response.json();
      return newTokenData; // may include rotated refresh_token
    } catch (error: unknown) {
      if (error instanceof TokenError || error instanceof TokenExpiredError) {
        // Re-throw our custom exceptions
        throw error;
      }

      if (error && typeof error === 'object' && 'name' in error) {
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
          _logger.warn('Timeout during token refresh');
          throw new TokenError('Token refresh timed out. Please check your connection.');
        }
        if (
          error.name === 'TypeError' &&
          'message' in error &&
          typeof error.message === 'string' &&
          error.message.includes('fetch')
        ) {
          _logger.warn(`Network error during token refresh: ${error.message}`);
          throw new TokenError('Network error during token refresh. Please check your connection.');
        }
      }

      _logger.error('Unexpected error during token refresh:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new TokenError(`Token refresh failed: ${errorMessage}`);
    }
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
  } catch (_error) {
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

/**
 * Check if cached token is active without attempting refresh.
 * @param apiBaseUrl - Base URL of the API (for compatibility, not used)
 * @returns True if token is active
 */
export async function isTokenActive(_apiBaseUrl?: string): Promise<boolean> {
  try {
    const storage = getTokenStorage();
    const tokenData = await storage.loadToken();

    if (!tokenData?.access_token) {
      return false;
    }

    const cfg = getStaticConfig();

    // Get userinfo endpoint from OIDC discovery
    const oidcConfig = await getOidcConfig(cfg.authIssuer);
    const userinfoEndpoint = oidcConfig.userinfo_endpoint;

    // Test the access token via userinfo endpoint
    const fetchPromise = fetch(userinfoEndpoint, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      ...(typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
        ? { signal: AbortSignal.timeout(10000) }
        : {}),
    });

    const response = await withTimeout(fetchPromise, 10000);

    return response.ok;
  } catch (_error) {
    return false;
  }
}

/**
 * Check if cached token is active, attempting refresh if needed.
 * @param apiBaseUrl - Base URL of the API (for compatibility, not used)
 * @returns True if token is active or was successfully refreshed
 */
export async function isTokenActiveWithRefresh(apiBaseUrl?: string): Promise<boolean> {
  try {
    const tokenManager = new TokenManager(apiBaseUrl || '');
    await tokenManager.getValidToken();
    return true;
  } catch (error) {
    _logger.warn('Token validation/refresh failed:', error);
    return false;
  }
}

/**
 * Validate a token using fast-path local verification with remote fallback.
 * @param token - The JWT token to validate
 * @param apiBaseUrl - Base URL of the API (for compatibility, not used)
 * @returns Dictionary with 'valid' key indicating if token is valid
 */
export async function validateToken(
  token: string,
  _apiBaseUrl?: string
): Promise<{ valid: boolean }> {
  try {
    const cfg = getStaticConfig();

    // Fast path: local JWT verification
    const jwtValid = await verifyJWTLocal(token, cfg.authIssuer, cfg.apiAudience);

    if (jwtValid === JWTVerificationResult.VALID) {
      return { valid: true };
    }

    if (jwtValid === JWTVerificationResult.INVALID) {
      // Couldn't verify locally, try remote validation
      try {
        const oidcConfig = await getOidcConfig(cfg.authIssuer);
        const userinfoEndpoint = oidcConfig.userinfo_endpoint;

        const fetchPromise = fetch(userinfoEndpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          ...(typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
            ? { signal: AbortSignal.timeout(5000) }
            : {}),
        });

        const response = await withTimeout(fetchPromise, 5000);
        return { valid: response.ok };
      } catch (error) {
        _logger.warn('Remote token validation failed:', error);
        return { valid: false };
      }
    }

    // Token is expired or invalid
    return { valid: false };
  } catch (error) {
    _logger.warn('Token validation failed:', error);
    return { valid: false };
  }
}
