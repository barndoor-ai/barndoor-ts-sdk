/**
 * Tests for authentication fixes:
 * - validateCachedToken timeout
 * - organization ID extraction
 * - API URL configuration
 */

import * as SDK from '../dist/index.esm.js';
const { BarndoorSDK, getDynamicConfig, getStaticConfig, checkTokenOrganization } = SDK;

// Mock fetch with timeout simulation
let mockFetchBehavior = 'success';
const mockFetch = {
  fn: () => {},
  mockClear: () => {
    mockFetch.fn = () => {};
    mockFetch.calls = [];
  },
  calls: [],
};

global.fetch = (...args) => {
  mockFetch.calls.push(args);
  return mockFetch.fn(...args);
};

beforeEach(() => {
  mockFetchBehavior = 'success';
  mockFetch.mockClear();

  mockFetch.fn = async (url, options) => {
    // Simulate different behaviors
    if (mockFetchBehavior === 'hang') {
      // Never resolve - simulates hanging
      return new Promise(() => {});
    } else if (mockFetchBehavior === 'timeout') {
      // Check if aborted
      if (options?.signal) {
        return new Promise((resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            reject(new Error('The operation was aborted'));
          });
        });
      }
    } else if (mockFetchBehavior === 'success') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ user: 'test' }),
      };
    } else if (mockFetchBehavior === 'unauthorized') {
      return {
        ok: false,
        status: 401,
      };
    }
  };
});

describe('validateCachedToken timeout fix', () => {
  // Create a valid JWT token for testing
  const validToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    Buffer.from(
      JSON.stringify({
        sub: '1234567890',
        name: 'Test User',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    )
      .toString('base64')
      .replace(/=/g, '') +
    '.signature';

  test('validateCachedToken completes within timeout', async () => {
    mockFetchBehavior = 'success';
    const sdk = new BarndoorSDK('https://api.test.com', { token: validToken });

    const startTime = Date.now();
    const result = await sdk.validateCachedToken();
    const elapsed = Date.now() - startTime;

    expect(result).toBe(true);
    expect(elapsed).toBeLessThan(1000); // Should be fast
  });

  test('validateCachedToken returns false on timeout', async () => {
    mockFetchBehavior = 'timeout';
    const sdk = new BarndoorSDK('https://api.test.com', { token: validToken });

    const startTime = Date.now();
    const result = await sdk.validateCachedToken();
    const elapsed = Date.now() - startTime;

    expect(result).toBe(false);
    expect(elapsed).toBeLessThan(11000); // Should timeout at ~10 seconds
  }, 15000);

  test('validateCachedToken returns false on 401', async () => {
    mockFetchBehavior = 'unauthorized';
    const sdk = new BarndoorSDK('https://api.test.com', { token: validToken });

    const result = await sdk.validateCachedToken();
    expect(result).toBe(false);
  });
});

describe('Organization ID extraction', () => {
  test('does not use org_id fields for subdomain extraction', () => {
    const tokenWithOrgId =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      Buffer.from(
        JSON.stringify({
          org_id: 'org_gFEnMMMIhsK5yiW9',
          iat: 1600000000,
          exp: 1600003600,
        })
      )
        .toString('base64')
        .replace(/=/g, '') +
      '.signature';

    const result = checkTokenOrganization(tokenWithOrgId);
    expect(result.hasOrganization).toBe(false);
    expect(result.error).toContain('No organization information found in token');
  });

  test('prioritizes organization_name over org_id', () => {
    const tokenWithBothFields =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      Buffer.from(
        JSON.stringify({
          organization_name: 'barndoor-ai',
          org_id: 'org_gFEnMMMIhsK5yiW9',
          iat: 1600000000,
          exp: 1600003600,
        })
      )
        .toString('base64')
        .replace(/=/g, '') +
      '.signature';

    const result = checkTokenOrganization(tokenWithBothFields);
    expect(result.hasOrganization).toBe(true);
    expect(result.organizationId).toBe('barndoor-ai');
  });

  test('does not use organization_id fields for subdomain extraction', () => {
    const tokenWithOrgId =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      Buffer.from(
        JSON.stringify({
          organization_id: 'fcdc562c-546c-4cca-8fee-e557a642dc9d',
          iat: 1600000000,
          exp: 1600003600,
        })
      )
        .toString('base64')
        .replace(/=/g, '') +
      '.signature';

    const result = checkTokenOrganization(tokenWithOrgId);
    expect(result.hasOrganization).toBe(false);
    expect(result.error).toContain('No organization information found in token');
  });

  test('handles various organization field locations', () => {
    const testCases = [
      {
        name: 'organization_slug',
        payload: { organization_slug: 'test-org-slug' },
        expected: 'test-org-slug',
      },
      {
        name: 'https://barndoor.ai/organization_slug',
        payload: { 'https://barndoor.ai/organization_slug': 'custom-claim-slug' },
        expected: 'custom-claim-slug',
      },
      {
        name: 'user.organization_name',
        payload: { user: { organization_name: 'user-org-name' } },
        expected: 'user-org-name',
      },
    ];

    testCases.forEach(({ name, payload, expected }) => {
      const token =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        Buffer.from(
          JSON.stringify({
            ...payload,
            iat: 1600000000,
            exp: 1600003600,
          })
        )
          .toString('base64')
          .replace(/=/g, '') +
        '.signature';

      const result = checkTokenOrganization(token);
      expect(result.hasOrganization).toBe(true);
      expect(result.organizationId).toBe(expected);
    });
  });
});

describe('Environment-specific API URLs', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('development environment uses correct subdomain pattern', () => {
    // Clear any environment variables that might interfere
    delete process.env.BARNDOOR_API;
    delete process.env.BARNDOOR_URL;
    delete process.env.API_AUDIENCE;
    process.env.MODE = 'dev';
    const config = getStaticConfig();

    // Now uses {org_slug} placeholder and platform subdomain for dev
    expect(config.baseUrl).toBe('https://{org_slug}.platform.barndoordev.com');
    expect(config.apiAudience).toBe('https://barndoor.ai/');
  });

  test('production environment uses correct subdomain pattern', () => {
    // Clear any environment variables that might interfere
    delete process.env.BARNDOOR_API;
    delete process.env.BARNDOOR_URL;
    delete process.env.API_AUDIENCE;
    process.env.MODE = 'production';
    const config = getStaticConfig();

    // Now uses {org_slug} placeholder
    expect(config.baseUrl).toBe('https://{org_slug}.mcp.barndoor.ai');
    expect(config.apiAudience).toBe('https://barndoor.ai/');
  });

  test('dynamic config substitutes organization correctly', () => {
    const token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      Buffer.from(
        JSON.stringify({
          organization_name: 'barndoor-ai',
          iat: 1600000000,
          exp: 1600003600,
        })
      )
        .toString('base64')
        .replace(/=/g, '') +
      '.signature';

    // Clear environment variables first
    delete process.env.BARNDOOR_API;
    delete process.env.BARNDOOR_URL;
    delete process.env.API_AUDIENCE;
    process.env.MODE = 'dev';
    const devConfig = getDynamicConfig(token);
    expect(devConfig.baseUrl).toBe('https://barndoor-ai.platform.barndoordev.com');

    // Clear environment variables again for production test
    delete process.env.BARNDOOR_API;
    delete process.env.BARNDOOR_URL;
    delete process.env.API_AUDIENCE;
    process.env.MODE = 'production';
    const prodConfig = getDynamicConfig(token);
    expect(prodConfig.baseUrl).toBe('https://barndoor-ai.mcp.barndoor.ai');
  });
});
