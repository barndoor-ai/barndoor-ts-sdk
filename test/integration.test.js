/**
 * Integration tests for the Barndoor SDK.
 * 
 * These tests verify that the main components work together correctly
 * and that the API is compatible with the Python SDK.
 */

import {
  BarndoorSDK,
  BarndoorError,
  HTTPError,
  ConfigurationError,
  TokenError
} from '../dist/index.esm.js';
import { ServerSummary, ServerDetail } from '../src/models/index.js';
import { BarndoorConfig } from '../src/config.js';

describe('SDK Integration Tests', () => {
  const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

  test('SDK can be instantiated with valid parameters', () => {
    const sdk = new BarndoorSDK('https://api.example.com', { token: validToken });
    expect(sdk).toBeInstanceOf(BarndoorSDK);
    expect(sdk.base).toBe('https://api.example.com');
    expect(sdk.token).toBe(validToken);
  });

  test('SDK throws appropriate errors for invalid parameters', () => {
    expect(() => new BarndoorSDK('invalid-url', { token: validToken }))
      .toThrow(ConfigurationError);
    
    expect(() => new BarndoorSDK('https://api.example.com', { token: 'invalid' }))
      .toThrow(TokenError);
  });

  test('Exception hierarchy is correct', () => {
    const authError = new HTTPError(401, 'Unauthorized');
    expect(authError).toBeInstanceOf(BarndoorError);
    expect(authError.statusCode).toBe(401);
  });

  test('Models can be created from API data', () => {
    const serverData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Test Server',
      slug: 'test-server',
      provider: 'github',
      connection_status: 'connected'
    };

    const server = ServerSummary.fromApiResponse(serverData);
    expect(server).toBeInstanceOf(ServerSummary);
    expect(server.id).toBe(serverData.id);
    expect(server.name).toBe(serverData.name);

    const detailData = { ...serverData, url: 'https://api.example.com/mcp' };
    const detail = ServerDetail.fromApiResponse(detailData);
    expect(detail).toBeInstanceOf(ServerDetail);
    expect(detail).toBeInstanceOf(ServerSummary);
    expect(detail.url).toBe(detailData.url);
  });

  test('Configuration works with environment variables', () => {
    const originalEnv = process.env.AUTH_DOMAIN;
    process.env.AUTH_DOMAIN = 'test.auth0.com';

    const config = new BarndoorConfig();
    expect(config.authDomain).toBe('test.auth0.com');

    // Restore original environment
    if (originalEnv) {
      process.env.AUTH_DOMAIN = originalEnv;
    } else {
      delete process.env.AUTH_DOMAIN;
    }
  });

  test('Configuration validation works', () => {
    const config = new BarndoorConfig({ authDomain: '' });
    expect(() => config.validate()).toThrow(ConfigurationError);
    expect(() => config.validate()).toThrow('authDomain is required');
  });

  test('SDK can be closed properly', async () => {
    const sdk = new BarndoorSDK('https://api.example.com', { token: validToken });
    await sdk.close();
    expect(sdk._closed).toBe(true);
  });
});

describe('API Compatibility', () => {
  test('method names match Python SDK (camelCase conversion)', () => {
    const sdk = new BarndoorSDK('https://api.example.com', { 
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    });

    // Check that JavaScript methods exist (Python equivalents in comments)
    expect(typeof sdk.listServers).toBe('function');        // list_servers
    expect(typeof sdk.getServer).toBe('function');          // get_server
    expect(typeof sdk.initiateConnection).toBe('function'); // initiate_connection
    expect(typeof sdk.getConnectionStatus).toBe('function'); // get_connection_status
    expect(typeof sdk.disconnectServer).toBe('function');   // disconnect_server
    expect(typeof sdk.ensureServerConnected).toBe('function'); // ensure_server_connected
    expect(typeof sdk.validateCachedToken).toBe('function'); // validate_cached_token
    expect(typeof sdk.close).toBe('function');              // close
    expect(typeof sdk.aclose).toBe('function');             // aclose
  });

  test('error messages are user-friendly like Python SDK', () => {
    const httpError = new HTTPError(404, 'Not Found');
    expect(httpError.message).toContain('Resource not found');
    expect(httpError.message).toContain('check the server ID');

    const authError = new HTTPError(401, 'Unauthorized');
    expect(authError.message).toContain('Authentication failed');
    expect(authError.message).toContain('check your token');
  });

  test('model structure matches Python SDK', () => {
    const serverData = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Test Server',
      slug: 'test-server',
      provider: 'github',
      connection_status: 'connected'
    };

    const server = new ServerSummary(serverData);
    
    // Check that all Python SDK fields are present
    expect(server).toHaveProperty('id');
    expect(server).toHaveProperty('name');
    expect(server).toHaveProperty('slug');
    expect(server).toHaveProperty('provider');
    expect(server).toHaveProperty('connection_status');

    // Check field types match expectations
    expect(typeof server.id).toBe('string');
    expect(typeof server.name).toBe('string');
    expect(typeof server.slug).toBe('string');
    expect(typeof server.connection_status).toBe('string');
    expect(server.provider === null || typeof server.provider === 'string').toBe(true);
  });
});
