/**
 * Configuration management for the Barndoor SDK.
 *
 * This module provides unified configuration that mirrors the Python SDK's
 * configuration system, supporting environment-specific defaults and
 * dynamic organization slug substitution.
 */

import { ConfigurationError } from './exceptions';

/**
 * Baked-in auth configuration per environment.
 * Users should NOT need to configure these - just set BARNDOOR_ENV.
 *
 * We have 6 environments: 3 for trial (Keycloak), 3 for enterprise (Auth0).
 * Will consolidate in the future.
 */
export const AUTH_CONFIG: Record<string, { issuer: string; audience: string; baseUrl: string }> = {
  // === Trial environments (Keycloak) - DEFAULT ===
  production: {
    issuer: 'https://auth.trial.barndoor.ai/realms/barndoor',
    audience: 'https://barndoor.ai/',
    baseUrl: 'https://{org_slug}.platform.barndoor.ai',
  },
  uat: {
    issuer: 'https://auth.barndooruat.com/realms/barndoor',
    audience: 'https://barndoor.ai/',
    baseUrl: 'https://{org_slug}.trial.barndooruat.com',
  },
  dev: {
    issuer: 'https://auth.barndoordev.com/realms/barndoor',
    audience: 'https://barndoor.ai/',
    baseUrl: 'https://{org_slug}.platform.barndoordev.com',
  },
  // === Enterprise environments (Auth0) ===
  'enterprise-production': {
    issuer: 'https://auth.barndoor.ai',
    audience: 'https://barndoor.ai/',
    baseUrl: 'https://{org_slug}.mcp.barndoor.ai',
  },
  'enterprise-uat': {
    issuer: 'https://auth.barndooruat.com',
    audience: 'https://barndoor.ai/',
    baseUrl: 'https://{org_slug}.mcp.barndooruat.com',
  },
  'enterprise-dev': {
    issuer: 'https://auth.barndoordev.com',
    audience: 'https://barndoor.ai/',
    baseUrl: 'https://{org_slug}.mcp.barndoordev.com',
  },
  // === Local development (Keycloak) ===
  localdev: {
    issuer: 'http://localhost:8080/realms/barndoor',
    audience: 'https://barndoor.ai/',
    baseUrl: 'http://localhost:8000',
  },
};

/**
 * Environment detection utilities
 *
 * Improved detection that works correctly under bundlers where process gets shimmed.
 * We check for window first since that's the most reliable browser indicator.
 */
export const isBrowser: boolean =
  typeof window !== 'undefined' && typeof window.document !== 'undefined';
export const isNode: boolean =
  typeof window === 'undefined' &&
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
  /** OIDC issuer URL (e.g., https://auth.barndoor.ai) */
  authIssuer?: string;
  /** @deprecated Use authIssuer instead. Auth domain for backwards compatibility. */
  authDomain?: string;
  /** OAuth client ID */
  clientId?: string;
  /** OAuth client secret */
  clientSecret?: string;
  /** API audience identifier */
  apiAudience?: string;
  /** Base URL template */
  baseUrl?: string;
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
 * Normalize environment mode string to canonical form.
 */
function normalizeEnvironmentMode(env: string): string {
  const envModeMap: Record<string, string> = {
    // Trial (default)
    production: 'production',
    prod: 'production',
    uat: 'uat',
    dev: 'dev',
    development: 'dev',
    // Enterprise (requires prefix)
    'enterprise-production': 'enterprise-production',
    'enterprise-prod': 'enterprise-production',
    'enterprise-uat': 'enterprise-uat',
    'enterprise-dev': 'enterprise-dev',
    enterprise: 'enterprise-production', // Default enterprise to prod
    // Local
    localdev: 'localdev',
    local: 'localdev',
  };
  return envModeMap[env.toLowerCase()] ?? 'production';
}

/**
 * Unified configuration for the Barndoor SDK.
 *
 * Mirrors the Python SDK's BarndoorConfig class with environment-specific
 * defaults and support for organization slug templating.
 */
export class BarndoorConfig {
  /** OIDC issuer URL */
  public authIssuer: string;
  /** OAuth client ID */
  public clientId: string;
  /** OAuth client secret */
  public clientSecret: string;
  /** API audience identifier */
  public apiAudience: string;
  /** Base URL template */
  public baseUrl: string;
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
    // Determine environment first (needed for baked-in config lookup)
    const rawEnv =
      options.environment ?? (getEnvVar('MODE') || getEnvVar('BARNDOOR_ENV') || 'production');
    this.environment = normalizeEnvironmentMode(rawEnv);

    // Get baked-in auth config for this environment
    const authCfg = AUTH_CONFIG[this.environment] ?? AUTH_CONFIG['production']!;

    // Authentication settings - auth issuer is baked in, with optional override via AUTH_URL
    // Support both authIssuer and legacy authDomain
    const envAuthUrl = getEnvVar('AUTH_URL');
    const legacyDomain = options.authDomain ?? getEnvVar('AUTH_DOMAIN');
    if (options.authIssuer) {
      this.authIssuer = options.authIssuer;
    } else if (envAuthUrl) {
      this.authIssuer = envAuthUrl;
    } else if (legacyDomain) {
      // Convert legacy domain to issuer URL
      this.authIssuer = legacyDomain.startsWith('http') ? legacyDomain : `https://${legacyDomain}`;
    } else {
      this.authIssuer = authCfg.issuer;
    }

    this.clientId =
      options.clientId ?? (getEnvVar('AGENT_CLIENT_ID') || getEnvVar('AUTH_CLIENT_ID') || '');
    this.clientSecret =
      options.clientSecret ??
      (getEnvVar('AGENT_CLIENT_SECRET') || getEnvVar('AUTH_CLIENT_SECRET') || '');
    this.apiAudience = options.apiAudience ?? (getEnvVar('API_AUDIENCE') || authCfg.audience);

    // Runtime settings
    this.promptForLogin = options.promptForLogin ?? false;
    this.skipLoginLocal = options.skipLoginLocal ?? false;

    // Set base_url from config, with optional override
    this.baseUrl =
      options.baseUrl ??
      (getEnvVar('BARNDOOR_API') || getEnvVar('BARNDOOR_URL') || authCfg.baseUrl);
  }

  /**
   * Extract domain from issuer URL for backwards compatibility.
   * @deprecated Use authIssuer instead
   */
  public get authDomain(): string {
    let issuer = this.authIssuer;
    if (issuer.startsWith('https://')) {
      issuer = issuer.slice(8);
    } else if (issuer.startsWith('http://')) {
      issuer = issuer.slice(7);
    }
    // Return domain + path (needed for Keycloak realms)
    return issuer;
  }

  /**
   * Get static configuration (without organization ID substitution).
   * @returns Static configuration instance
   */
  public static getStaticConfig(): BarndoorConfig {
    return new BarndoorConfig();
  }

  /**
   * Get dynamic configuration with organization slug substituted.
   * @param jwtToken - JWT token to extract organization slug from
   * @param options - Configuration options
   * @returns Dynamic configuration instance
   */
  public static getDynamicConfig(
    jwtToken: string,
    options: {
      /** Whether to throw error for tokens without organization info */
      requireOrganization?: boolean;
      /** Fallback organization slug to use if none found in token */
      fallbackOrganizationId?: string;
    } = {}
  ): BarndoorConfig {
    const { requireOrganization = true, fallbackOrganizationId } = options;
    const config = new BarndoorConfig();

    // Try to extract organization slug safely
    const orgResult = extractOrganizationIdSafe(jwtToken);

    if (orgResult.hasOrganization) {
      // Organization found - validate and substitute in URLs
      const raw = String(orgResult.organizationId ?? '')
        .trim()
        .toLowerCase();
      // Validate subdomain format: must start with alphanumeric, contain only alphanumeric and hyphens,
      // and not end with a hyphen. Underscores are not valid in DNS subdomains.
      const safe = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(raw);
      if (!safe) {
        throw new ConfigurationError('Invalid organization subdomain format from token');
      }
      config.baseUrl = config.baseUrl.replace('{org_slug}', raw);
      return config;
    }

    // No organization found - handle based on options
    if (fallbackOrganizationId) {
      // Use fallback organization slug
      config.baseUrl = config.baseUrl.replace('{org_slug}', fallbackOrganizationId);
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

    // Return config without organization substitution (URLs will contain {org_slug} placeholder)
    return config;
  }

  /**
   * Validate the configuration.
   * @throws ConfigurationError if configuration is invalid
   */
  public validate(): void {
    if (!this.authIssuer || this.authIssuer.trim() === '') {
      throw new ConfigurationError('authIssuer is required');
    }

    if (!this.apiAudience || this.apiAudience.trim() === '') {
      throw new ConfigurationError('apiAudience is required');
    }

    if (!this.baseUrl || this.baseUrl.trim() === '') {
      throw new ConfigurationError('baseUrl is required');
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
        error: 'Invalid JWT format - expected 3 parts separated by dots',
      };
    }

    let payload: JWTPayload;
    try {
      payload = JSON.parse(
        base64Decode(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'))
      ) as JWTPayload;
    } catch (_parseError) {
      return {
        hasOrganization: false,
        error: 'Failed to parse JWT payload - token may be corrupted',
      };
    }

    // Try multiple possible locations for organization information
    let orgSlug: string | undefined;

    // Check user object first (most common location)
    if (payload.user && typeof payload.user === 'object') {
      orgSlug = payload.user.organization_name ?? payload.user.organization_slug;
    }

    // Check custom claims and standard locations
    // Note: We only use slug/name fields that are valid for subdomains
    // org_id fields like 'org_gFEnMMMIhsK5yiW9' are not valid for DNS
    if (!orgSlug) {
      const customClaimSlug = payload['https://barndoor.ai/organization_slug'];
      const orgSlugClaim = payload['organization_slug'];
      const orgNameClaim = payload['organization_name'];
      const orgSlugShort = payload['org_slug'];

      orgSlug =
        (typeof orgNameClaim === 'string' ? orgNameClaim : undefined) ??
        (typeof customClaimSlug === 'string' ? customClaimSlug : undefined) ??
        (typeof orgSlugClaim === 'string' ? orgSlugClaim : undefined) ??
        (typeof orgSlugShort === 'string' ? orgSlugShort : undefined);
    }

    if (!orgSlug || typeof orgSlug !== 'string' || orgSlug.trim() === '') {
      return {
        hasOrganization: false,
        error:
          'No organization information found in token. This token may be for a personal account or may be missing organization claims.',
      };
    }

    return {
      organizationId: orgSlug.trim(),
      hasOrganization: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      hasOrganization: false,
      error: `Failed to decode JWT token: ${errorMessage}`,
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
export function getDynamicConfig(
  jwtToken: string,
  options?: {
    requireOrganization?: boolean;
    fallbackOrganizationId?: string;
  }
): BarndoorConfig {
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
