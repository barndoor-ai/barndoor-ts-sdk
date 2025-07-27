/**
 * Configuration management for the Barndoor SDK.
 * 
 * This module provides unified configuration that mirrors the Python SDK's
 * configuration system, supporting environment-specific defaults and
 * dynamic organization ID substitution.
 */

import { ConfigurationError } from './exceptions/index.js';

/**
 * Environment detection utilities
 */
export const isBrowser = typeof window !== 'undefined';
export const isNode = typeof process !== 'undefined' && process.versions?.node;

/**
 * Get environment variable value (works in both Node.js and browser)
 */
function getEnvVar(name, defaultValue = '') {
  if (isNode) {
    return process.env[name] || defaultValue;
  } else if (isBrowser && window.ENV) {
    // Browser environment with injected ENV object
    return window.ENV[name] || defaultValue;
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
  /**
   * @param {Object} [options={}] - Configuration options
   * @param {string} [options.authDomain] - Auth0 domain
   * @param {string} [options.clientId] - OAuth client ID
   * @param {string} [options.clientSecret] - OAuth client secret
   * @param {string} [options.apiAudience] - API audience identifier
   * @param {string} [options.apiBaseUrl] - API base URL template
   * @param {string} [options.mcpBaseUrl] - MCP base URL template
   * @param {string} [options.environment] - Environment name
   * @param {boolean} [options.promptForLogin] - Whether to prompt for login
   * @param {boolean} [options.skipLoginLocal] - Whether to skip login in local env
   */
  constructor(options = {}) {
    // Authentication settings
    this.authDomain = options.authDomain !== undefined ? options.authDomain : (getEnvVar('AUTH_DOMAIN') || 'auth.barndoor.ai');
    this.clientId = options.clientId !== undefined ? options.clientId : (getEnvVar('AGENT_CLIENT_ID') || '');
    this.clientSecret = options.clientSecret !== undefined ? options.clientSecret : (getEnvVar('AGENT_CLIENT_SECRET') || '');
    this.apiAudience = options.apiAudience !== undefined ? options.apiAudience : (getEnvVar('API_AUDIENCE') || 'https://barndoor.ai/');
    
    // Environment settings
    this.environment = options.environment || 
                      getEnvVar('MODE') || 
                      getEnvVar('BARNDOOR_ENV') || 
                      'production';
    
    // Runtime settings
    this.promptForLogin = options.promptForLogin ?? false;
    this.skipLoginLocal = options.skipLoginLocal ?? false;
    
    // Set environment-specific defaults
    this._setEnvironmentDefaults(options);
  }
  
  /**
   * Set environment-specific default URLs.
   * @private
   */
  _setEnvironmentDefaults(options) {
    const env = this.environment.toLowerCase();
    
    if (env === 'localdev' || env === 'local') {
      this.authDomain = this.authDomain || 'localhost:3001';
      this.apiBaseUrl = options.apiBaseUrl || 
                       getEnvVar('BARNDOOR_API') || 
                       'http://localhost:8000';
      this.mcpBaseUrl = options.mcpBaseUrl || 
                       getEnvVar('BARNDOOR_URL') || 
                       'http://localhost:8000';
    } else if (env === 'development' || env === 'dev') {
      this.apiBaseUrl = options.apiBaseUrl || 
                       getEnvVar('BARNDOOR_API') || 
                       'https://{organization_id}.mcp.barndoordev.com';
      this.mcpBaseUrl = options.mcpBaseUrl || 
                       getEnvVar('BARNDOOR_URL') || 
                       'https://{organization_id}.mcp.barndoordev.com';
    } else { // production
      this.apiBaseUrl = options.apiBaseUrl || 
                       getEnvVar('BARNDOOR_API') || 
                       'https://{organization_id}.mcp.barndoor.ai';
      this.mcpBaseUrl = options.mcpBaseUrl || 
                       getEnvVar('BARNDOOR_URL') || 
                       'https://{organization_id}.mcp.barndoor.ai';
    }
  }
  
  /**
   * Get static configuration (without organization ID substitution).
   * @returns {BarndoorConfig}
   */
  static getStaticConfig() {
    return new BarndoorConfig();
  }
  
  /**
   * Get dynamic configuration with organization ID substituted.
   * @param {string} jwtToken - JWT token to extract organization ID from
   * @returns {BarndoorConfig}
   */
  static getDynamicConfig(jwtToken) {
    const config = new BarndoorConfig();
    
    try {
      // Extract organization ID from JWT token
      const orgId = extractOrganizationId(jwtToken);
      
      // Substitute {organization_id} in URLs
      config.apiBaseUrl = config.apiBaseUrl.replace('{organization_id}', orgId);
      config.mcpBaseUrl = config.mcpBaseUrl.replace('{organization_id}', orgId);
      
      return config;
    } catch (error) {
      throw new ConfigurationError(`Failed to extract organization ID from token: ${error.message}`);
    }
  }
  
  /**
   * Validate the configuration.
   * @throws {ConfigurationError} If configuration is invalid
   */
  validate() {
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
 * Extract organization ID from JWT token.
 * @param {string} jwtToken - JWT token
 * @returns {string} Organization ID
 * @throws {Error} If token is invalid or organization ID not found
 */
function extractOrganizationId(jwtToken) {
  try {
    // Decode JWT payload (second part of the token)
    const parts = jwtToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    
    // Decode base64url payload
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    // Extract organization ID from custom claims
    const orgId = payload['https://barndoor.ai/organization_id'] || 
                  payload.org_id || 
                  payload.organization_id;
    
    if (!orgId) {
      throw new Error('Organization ID not found in token');
    }
    
    return orgId;
  } catch (error) {
    throw new Error(`Failed to decode JWT token: ${error.message}`);
  }
}

/**
 * Get static configuration instance.
 * @returns {BarndoorConfig}
 */
export function getStaticConfig() {
  return BarndoorConfig.getStaticConfig();
}

/**
 * Get dynamic configuration with organization ID substituted.
 * @param {string} jwtToken - JWT token
 * @returns {BarndoorConfig}
 */
export function getDynamicConfig(jwtToken) {
  return BarndoorConfig.getDynamicConfig(jwtToken);
}
