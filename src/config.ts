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
 * Cross-platform base64 decode function.
 * @param str - Base64 string to decode
 * @returns Decoded string
 */
function base64Decode(str: string): string {
  if (typeof globalThis !== 'undefined' && globalThis.atob) {
    return globalThis.atob(str);
  } else if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'base64').toString('utf-8');
  } else {
    throw new Error('No base64 decode function available');
  }
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
    const payload = JSON.parse(base64Decode(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as JWTPayload;

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
