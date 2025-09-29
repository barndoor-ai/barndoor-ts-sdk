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
 *
 * Improved detection that works correctly under bundlers where process gets shimmed.
 * We check for window first since that's the most reliable browser indicator.
 */
export const isBrowser: boolean = typeof window !== 'undefined' && typeof window.document !== 'undefined';
export const isNode: boolean = typeof window === 'undefined' &&
  typeof process !== 'undefined' &&
  process.versions != null &&
  process.versions.node != null;

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
                       (getEnvVar('BARNDOOR_MCP') || getEnvVar('BARNDOOR_URL') ||
                       'http://localhost:8000');
    } else if (env === 'development' || env === 'dev') {
      this.apiBaseUrl = options.apiBaseUrl ??
                       (getEnvVar('BARNDOOR_API') ||
                       'https://api.barndoordev.com');
      this.mcpBaseUrl = options.mcpBaseUrl ??
                       (getEnvVar('BARNDOOR_MCP') || getEnvVar('BARNDOOR_URL') ||
                       'https://{organization_id}.mcp.barndoordev.com');
    } else { // production
      this.apiBaseUrl = options.apiBaseUrl ??
                       (getEnvVar('BARNDOOR_API') ||
                       'https://api.barndoor.ai');
      this.mcpBaseUrl = options.mcpBaseUrl ??
                       (getEnvVar('BARNDOOR_MCP') || getEnvVar('BARNDOOR_URL') ||
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
   * @param options - Configuration options
   * @returns Dynamic configuration instance
   */
  public static getDynamicConfig(jwtToken: string, options: {
    /** Whether to throw error for tokens without organization info */
    requireOrganization?: boolean;
    /** Fallback organization ID to use if none found in token */
    fallbackOrganizationId?: string;
  } = {}): BarndoorConfig {
    const { requireOrganization = true, fallbackOrganizationId } = options;
    const config = new BarndoorConfig();

    // Try to extract organization ID safely
    const orgResult = extractOrganizationIdSafe(jwtToken);

    if (orgResult.hasOrganization) {
      // Organization found - substitute in URLs
      config.apiBaseUrl = config.apiBaseUrl.replace('{organization_id}', orgResult.organizationId!);
      config.mcpBaseUrl = config.mcpBaseUrl.replace('{organization_id}', orgResult.organizationId!);
      return config;
    }

    // No organization found - handle based on options
    if (fallbackOrganizationId) {
      // Use fallback organization ID
      config.apiBaseUrl = config.apiBaseUrl.replace('{organization_id}', fallbackOrganizationId);
      config.mcpBaseUrl = config.mcpBaseUrl.replace('{organization_id}', fallbackOrganizationId);
      return config;
    }

    if (requireOrganization) {
      // Throw error with helpful message
      const errorMessage = orgResult.error || 'No organization information found in token';
      throw new ConfigurationError(
        `Failed to extract organization ID from token: ${errorMessage}. ` +
        'This token may be for a personal account or may be missing organization claims. ' +
        'Consider using getStaticConfig() for organization-independent operations or ' +
        'provide a fallbackOrganizationId in the options.'
      );
    }

    // Return config without organization substitution (URLs will contain {organization_id} placeholder)
    return config;
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
 * Result of organization ID extraction from JWT token.
 */
interface OrganizationExtractionResult {
  /** Organization ID if found */
  organizationId?: string;
  /** Whether organization ID was found */
  hasOrganization: boolean;
  /** Error message if extraction failed */
  error?: string;
}

/**
 * Extract organization ID from JWT token with graceful fallback.
 * @param jwtToken - JWT token
 * @returns Organization extraction result
 */
function extractOrganizationIdSafe(jwtToken: string): OrganizationExtractionResult {
  try {
    const parts = jwtToken.split('.');
    if (parts.length !== 3) {
      return {
        hasOrganization: false,
        error: 'Invalid JWT format - expected 3 parts separated by dots'
      };
    }

    let payload: JWTPayload;
    try {
      payload = JSON.parse(base64Decode(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as JWTPayload;
    } catch (parseError) {
      return {
        hasOrganization: false,
        error: 'Failed to parse JWT payload - token may be corrupted'
      };
    }

    // Try multiple possible locations for organization information
    let orgSlug: string | undefined;

    // Check user object first (most common location)
    if (payload.user && typeof payload.user === 'object') {
      orgSlug = payload.user.organization_name ?? payload.user.organization_slug;
    }

    // Check custom claims and standard locations
    if (!orgSlug) {
      const customClaimSlug = payload['https://barndoor.ai/organization_slug'];
      const customClaimId = payload['https://barndoor.ai/organization_id'];
      const orgSlugClaim = payload.organization_slug;
      const orgSlugShort = payload.org_slug;
      const orgIdClaim = payload['org_id'];
      const organizationIdClaim = payload['organization_id'];

      orgSlug = (typeof customClaimSlug === 'string' ? customClaimSlug : undefined) ??
                (typeof customClaimId === 'string' ? customClaimId : undefined) ??
                (typeof orgSlugClaim === 'string' ? orgSlugClaim : undefined) ??
                (typeof orgSlugShort === 'string' ? orgSlugShort : undefined) ??
                (typeof orgIdClaim === 'string' ? orgIdClaim : undefined) ??
                (typeof organizationIdClaim === 'string' ? organizationIdClaim : undefined);
    }

    if (!orgSlug || typeof orgSlug !== 'string' || orgSlug.trim() === '') {
      return {
        hasOrganization: false,
        error: 'No organization information found in token. This token may be for a personal account or may be missing organization claims.'
      };
    }

    return {
      organizationId: orgSlug.trim(),
      hasOrganization: true
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      hasOrganization: false,
      error: `Failed to decode JWT token: ${errorMessage}`
    };
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
 * @param options - Configuration options
 * @returns Dynamic configuration instance
 */
export function getDynamicConfig(jwtToken: string, options?: {
  requireOrganization?: boolean;
  fallbackOrganizationId?: string;
}): BarndoorConfig {
  return BarndoorConfig.getDynamicConfig(jwtToken, options);
}

/**
 * Check if a JWT token contains organization information.
 * @param jwtToken - JWT token to check
 * @returns Object with organization info and any error details
 */
export function checkTokenOrganization(jwtToken: string): OrganizationExtractionResult {
  return extractOrganizationIdSafe(jwtToken);
}

/**
 * Check if a JWT token has organization information (simple boolean check).
 * @param jwtToken - JWT token to check
 * @returns True if token contains organization information
 */
export function hasOrganizationInfo(jwtToken: string): boolean {
  return extractOrganizationIdSafe(jwtToken).hasOrganization;
}
