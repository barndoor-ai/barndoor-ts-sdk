/**
 * Tests for configuration management.
 */

import { BarndoorConfig, getStaticConfig, getDynamicConfig, ConfigurationError } from '../dist/index.esm.js';

// Mock process.env for testing
const originalEnv = process.env;

beforeEach(() => {
  // Reset environment variables
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('BarndoorConfig', () => {
  test('creates config with default values', () => {
    const config = new BarndoorConfig();
    
    expect(config.authDomain).toBe('auth.barndoor.ai');
    expect(config.clientId).toBe('');
    expect(config.clientSecret).toBe('');
    expect(config.apiAudience).toBe('https://barndoor.ai/');
    expect(config.environment).toBe('production');
    expect(config.promptForLogin).toBe(false);
    expect(config.skipLoginLocal).toBe(false);
  });

  test('uses environment variables when available', () => {
    process.env.AUTH_DOMAIN = 'custom.auth0.com';
    process.env.AGENT_CLIENT_ID = 'test-client-id';
    process.env.AGENT_CLIENT_SECRET = 'test-client-secret';
    process.env.API_AUDIENCE = 'https://custom.api/';
    process.env.BARNDOOR_ENV = 'development';
    
    const config = new BarndoorConfig();
    
    expect(config.authDomain).toBe('custom.auth0.com');
    expect(config.clientId).toBe('test-client-id');
    expect(config.clientSecret).toBe('test-client-secret');
    expect(config.apiAudience).toBe('https://custom.api/');
    expect(config.environment).toBe('development');
  });

  test('constructor options override environment variables', () => {
    process.env.AUTH_DOMAIN = 'env.auth0.com';
    
    const config = new BarndoorConfig({
      authDomain: 'override.auth0.com'
    });
    
    expect(config.authDomain).toBe('override.auth0.com');
  });

  test('sets environment-specific defaults for localdev', () => {
    const config = new BarndoorConfig({ environment: 'localdev' });
    
    expect(config.apiBaseUrl).toBe('http://localhost:8000');
    expect(config.mcpBaseUrl).toBe('http://localhost:8000');
  });

  test('sets environment-specific defaults for development', () => {
    const config = new BarndoorConfig({ environment: 'development' });
    
    expect(config.apiBaseUrl).toBe('https://{organization_id}.mcp.barndoordev.com');
    expect(config.mcpBaseUrl).toBe('https://{organization_id}.mcp.barndoordev.com');
  });

  test('sets environment-specific defaults for production', () => {
    const config = new BarndoorConfig({ environment: 'production' });
    
    expect(config.apiBaseUrl).toBe('https://{organization_id}.mcp.barndoor.ai');
    expect(config.mcpBaseUrl).toBe('https://{organization_id}.mcp.barndoor.ai');
  });

  test('respects custom URLs even in specific environments', () => {
    process.env.BARNDOOR_API = 'https://custom.api.com';
    process.env.BARNDOOR_URL = 'https://custom.mcp.com';
    
    const config = new BarndoorConfig({ environment: 'localdev' });
    
    expect(config.apiBaseUrl).toBe('https://custom.api.com');
    expect(config.mcpBaseUrl).toBe('https://custom.mcp.com');
  });

  test('validation passes for valid config', () => {
    const config = new BarndoorConfig();
    expect(() => config.validate()).not.toThrow();
  });

  test('validation fails for missing required fields', () => {
    const config = new BarndoorConfig({ authDomain: '' });
    expect(() => config.validate()).toThrow(ConfigurationError);
    expect(() => config.validate()).toThrow('authDomain is required');
  });
});

describe('Static Configuration', () => {
  test('getStaticConfig returns BarndoorConfig instance', () => {
    const config = getStaticConfig();
    expect(config).toBeInstanceOf(BarndoorConfig);
  });

  test('BarndoorConfig.getStaticConfig returns same as function', () => {
    const config1 = getStaticConfig();
    const config2 = BarndoorConfig.getStaticConfig();
    
    expect(config1.authDomain).toBe(config2.authDomain);
    expect(config1.apiAudience).toBe(config2.apiAudience);
  });
});

describe('Dynamic Configuration', () => {
  const mockJwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwczovL2Jhcm5kb29yLmFpL29yZ2FuaXphdGlvbl9pZCI6InRlc3Qtb3JnIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDM2MDB9.signature';

  test('getDynamicConfig substitutes organization ID', () => {
    const config = getDynamicConfig(mockJwtToken);
    
    expect(config.apiBaseUrl).toBe('https://test-org.mcp.barndoor.ai');
    expect(config.mcpBaseUrl).toBe('https://test-org.mcp.barndoor.ai');
  });

  test('BarndoorConfig.getDynamicConfig works the same', () => {
    const config1 = getDynamicConfig(mockJwtToken);
    const config2 = BarndoorConfig.getDynamicConfig(mockJwtToken);
    
    expect(config1.apiBaseUrl).toBe(config2.apiBaseUrl);
    expect(config1.mcpBaseUrl).toBe(config2.mcpBaseUrl);
  });

  test('throws error for invalid JWT token', () => {
    expect(() => getDynamicConfig('invalid-token')).toThrow(ConfigurationError);
    expect(() => getDynamicConfig('invalid-token')).toThrow('Failed to extract organization ID');
  });

  test('throws error for JWT without organization ID', () => {
    const tokenWithoutOrgId = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMzYwMH0.signature';
    
    expect(() => getDynamicConfig(tokenWithoutOrgId)).toThrow(ConfigurationError);
    expect(() => getDynamicConfig(tokenWithoutOrgId)).toThrow('organization_name / organization_slug not found in token');
  });
});

describe('Environment Detection', () => {
  test('environment priority: MODE > BARNDOOR_ENV > default', () => {
    process.env.MODE = 'test-mode';
    process.env.BARNDOOR_ENV = 'test-barndoor-env';
    
    const config = new BarndoorConfig();
    expect(config.environment).toBe('test-mode');
    
    delete process.env.MODE;
    const config2 = new BarndoorConfig();
    expect(config2.environment).toBe('test-barndoor-env');
    
    delete process.env.BARNDOOR_ENV;
    const config3 = new BarndoorConfig();
    expect(config3.environment).toBe('production');
  });

  test('case insensitive environment matching', () => {
    const localConfig = new BarndoorConfig({ environment: 'LOCALDEV' });
    expect(localConfig.apiBaseUrl).toBe('http://localhost:8000');
    
    const devConfig = new BarndoorConfig({ environment: 'DEV' });
    expect(devConfig.apiBaseUrl).toBe('https://{organization_id}.mcp.barndoordev.com');
  });
});
