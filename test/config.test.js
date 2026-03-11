/**
 * Tests for configuration management.
 */

import {
  BarndoorConfig,
  getStaticConfig,
  getDynamicConfig,
  ConfigurationError,
} from '../dist/index.esm.js';

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
  test('creates config with default values (baked-in per environment)', () => {
    const config = new BarndoorConfig();

    // Default environment is production with trial (Keycloak) auth
    expect(config.authIssuer).toBe('https://auth.barndoor.ai/realms/barndoor');
    // authDomain is derived from authIssuer for backwards compatibility
    expect(config.authDomain).toBe('auth.barndoor.ai/realms/barndoor');
    expect(config.clientId).toBe('');
    expect(config.clientSecret).toBe('');
    expect(config.apiAudience).toBe('https://barndoor.ai/');
    expect(config.environment).toBe('production');
    expect(config.promptForLogin).toBe(false);
    expect(config.skipLoginLocal).toBe(false);
  });

  test('uses environment variables when available', () => {
    process.env.AUTH_URL = 'https://custom.auth.com';
    process.env.AGENT_CLIENT_ID = 'test-client-id';
    process.env.AGENT_CLIENT_SECRET = 'test-client-secret';
    process.env.API_AUDIENCE = 'https://custom.api/';
    process.env.BARNDOOR_ENV = 'dev';

    const config = new BarndoorConfig();

    expect(config.authIssuer).toBe('https://custom.auth.com');
    expect(config.clientId).toBe('test-client-id');
    expect(config.clientSecret).toBe('test-client-secret');
    expect(config.apiAudience).toBe('https://custom.api/');
    expect(config.environment).toBe('dev');
  });

  test('constructor options override environment variables', () => {
    process.env.AUTH_URL = 'https://env.auth.com';

    const config = new BarndoorConfig({
      authIssuer: 'https://override.auth.com',
    });

    expect(config.authIssuer).toBe('https://override.auth.com');
  });

  test('legacy authDomain option is converted to authIssuer', () => {
    const config = new BarndoorConfig({
      authDomain: 'legacy.auth0.com',
    });

    expect(config.authIssuer).toBe('https://legacy.auth0.com');
  });

  test('sets environment-specific defaults for localdev', () => {
    const config = new BarndoorConfig({ environment: 'localdev' });

    expect(config.baseUrl).toBe('http://localhost:8000');
    expect(config.authIssuer).toBe('http://localhost:8080/realms/barndoor');
  });

  test('sets environment-specific defaults for development/dev', () => {
    const config = new BarndoorConfig({ environment: 'dev' });

    expect(config.baseUrl).toBe('https://{org_slug}.platform.barndoordev.com');
    expect(config.authIssuer).toBe('https://auth.barndoordev.com/realms/barndoor');
  });

  test('sets environment-specific defaults for production', () => {
    const config = new BarndoorConfig({ environment: 'production' });

    expect(config.baseUrl).toBe('https://{org_slug}.platform.barndoor.ai');
    expect(config.authIssuer).toBe('https://auth.barndoor.ai/realms/barndoor');
  });

  test('supports enterprise environments', () => {
    const config = new BarndoorConfig({ environment: 'enterprise-production' });

    expect(config.authIssuer).toBe('https://auth.barndoor.ai');
    expect(config.baseUrl).toBe('https://{org_slug}.mcp.barndoor.ai');
  });

  test('respects custom URLs even in specific environments', () => {
    process.env.BARNDOOR_URL = 'https://custom.api.com';

    const config = new BarndoorConfig({ environment: 'localdev' });

    expect(config.baseUrl).toBe('https://custom.api.com');
  });

  test('options override env vars', () => {
    process.env.BARNDOOR_URL = 'https://env.com';

    const config = new BarndoorConfig({
      environment: 'production',
      baseUrl: 'https://api.options.com',
    });

    expect(config.baseUrl).toBe('https://api.options.com');
  });

  test('validation passes for valid config', () => {
    const config = new BarndoorConfig();
    expect(() => config.validate()).not.toThrow();
  });

  test('validation fails for missing required fields', () => {
    // authIssuer is baked in per environment, so we need to clear it after construction
    const config = new BarndoorConfig();
    // Manually clear the authIssuer to test validation
    Object.defineProperty(config, 'authIssuer', { value: '', writable: true });
    expect(() => config.validate()).toThrow(ConfigurationError);
    expect(() => config.validate()).toThrow('authIssuer is required');
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

    expect(config1.authIssuer).toBe(config2.authIssuer);
    expect(config1.apiAudience).toBe(config2.apiAudience);
  });
});

describe('Dynamic Configuration', () => {
  const mockJwtToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwczovL2Jhcm5kb29yLmFpL29yZ2FuaXphdGlvbl9pZCI6InRlc3Qtb3JnIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDM2MDB9.signature';

  test.skip('getDynamicConfig substitutes organization ID - needs update for organization_name', () => {
    const config = getDynamicConfig(mockJwtToken);

    expect(config.baseUrl).toBe('https://test-org.platform.barndoor.ai');
  });

  test.skip('BarndoorConfig.getDynamicConfig works the same - needs update for organization_name', () => {
    const config1 = getDynamicConfig(mockJwtToken);
    const config2 = BarndoorConfig.getDynamicConfig(mockJwtToken);

    expect(config1.baseUrl).toBe(config2.baseUrl);
  });

  test('throws error for invalid JWT token', () => {
    expect(() => getDynamicConfig('invalid-token')).toThrow(ConfigurationError);
    expect(() => getDynamicConfig('invalid-token')).toThrow('Failed to extract organization ID');
  });

  test('throws error for JWT without organization ID', () => {
    const tokenWithoutOrgId =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMzYwMH0.signature';

    expect(() => getDynamicConfig(tokenWithoutOrgId)).toThrow(ConfigurationError);
    expect(() => getDynamicConfig(tokenWithoutOrgId)).toThrow(
      'No organization information found in token'
    );
  });
});

describe('Environment Detection', () => {
  test('environment priority: MODE > BARNDOOR_ENV > default', () => {
    process.env.MODE = 'dev';
    process.env.BARNDOOR_ENV = 'uat';

    const config = new BarndoorConfig();
    expect(config.environment).toBe('dev');

    delete process.env.MODE;
    const config2 = new BarndoorConfig();
    expect(config2.environment).toBe('uat');

    delete process.env.BARNDOOR_ENV;
    const config3 = new BarndoorConfig();
    expect(config3.environment).toBe('production');
  });

  test('case insensitive environment matching', () => {
    const localConfig = new BarndoorConfig({ environment: 'LOCALDEV' });
    expect(localConfig.baseUrl).toBe('http://localhost:8000');

    const devConfig = new BarndoorConfig({ environment: 'DEV' });
    expect(devConfig.baseUrl).toBe('https://{org_slug}.platform.barndoordev.com');
  });

  test('environment normalization works correctly', () => {
    // Trial environments
    expect(new BarndoorConfig({ environment: 'prod' }).environment).toBe('production');
    expect(new BarndoorConfig({ environment: 'development' }).environment).toBe('dev');
    expect(new BarndoorConfig({ environment: 'local' }).environment).toBe('localdev');

    // Enterprise environments
    expect(new BarndoorConfig({ environment: 'enterprise' }).environment).toBe(
      'enterprise-production'
    );
    expect(new BarndoorConfig({ environment: 'enterprise-prod' }).environment).toBe(
      'enterprise-production'
    );
  });
});
