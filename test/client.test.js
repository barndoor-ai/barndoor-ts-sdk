/**
 * Tests for the main BarndoorSDK client.
 */

import { BarndoorSDK } from '../src/client.js';
import { ServerSummary, ServerDetail } from '../src/models/index.js';
import { HTTPError, ConfigurationError, TokenError } from '../src/exceptions/index.js';

// Mock the auth module
jest.mock('../src/auth/index.js', () => ({
  loadUserToken: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn();

const { loadUserToken } = require('../src/auth/index.js');

beforeEach(() => {
  fetch.mockClear();
  loadUserToken.mockClear();
});

describe('BarndoorSDK Constructor', () => {
  const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

  test('creates SDK with valid parameters', () => {
    const sdk = new BarndoorSDK('https://api.example.com', { token: validToken });
    
    expect(sdk.base).toBe('https://api.example.com');
    expect(sdk.token).toBe(validToken);
    expect(sdk._closed).toBe(false);
  });

  test('strips trailing slash from base URL', () => {
    const sdk = new BarndoorSDK('https://api.example.com/', { token: validToken });
    expect(sdk.base).toBe('https://api.example.com');
  });

  test('loads token from storage when not provided', () => {
    loadUserToken.mockReturnValue(validToken);
    
    const sdk = new BarndoorSDK('https://api.example.com');
    expect(sdk.token).toBe(validToken);
    expect(loadUserToken).toHaveBeenCalled();
  });

  test('throws error when no token available', () => {
    loadUserToken.mockReturnValue(null);
    
    expect(() => new BarndoorSDK('https://api.example.com'))
      .toThrow('Barndoor user token not provided and none found in store');
  });

  test('validates URL format', () => {
    expect(() => new BarndoorSDK('invalid-url', { token: validToken }))
      .toThrow(ConfigurationError);
    
    expect(() => new BarndoorSDK('', { token: validToken }))
      .toThrow(ConfigurationError);
  });

  test('validates token format', () => {
    expect(() => new BarndoorSDK('https://api.example.com', { token: '' }))
      .toThrow(TokenError);
    
    expect(() => new BarndoorSDK('https://api.example.com', { token: 'invalid-jwt' }))
      .toThrow(TokenError);
  });

  test('validates timeout parameter', () => {
    expect(() => new BarndoorSDK('https://api.example.com', { 
      token: validToken, 
      timeout: -1 
    })).toThrow(ConfigurationError);
    
    expect(() => new BarndoorSDK('https://api.example.com', { 
      token: validToken, 
      timeout: 'invalid' 
    })).toThrow(ConfigurationError);
  });

  test('validates maxRetries parameter', () => {
    expect(() => new BarndoorSDK('https://api.example.com', { 
      token: validToken, 
      maxRetries: -1 
    })).toThrow(ConfigurationError);
    
    expect(() => new BarndoorSDK('https://api.example.com', { 
      token: validToken, 
      maxRetries: 1.5 
    })).toThrow(ConfigurationError);
  });
});

describe('BarndoorSDK Methods', () => {
  const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  let sdk;

  beforeEach(() => {
    // Mock environment to skip token validation
    process.env.BARNDOOR_ENV = 'localdev';
    sdk = new BarndoorSDK('https://api.example.com', { token: validToken });
  });

  afterEach(() => {
    delete process.env.BARNDOOR_ENV;
  });

  describe('listServers', () => {
    test('returns array of ServerSummary objects', async () => {
      const mockServers = [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Test Server 1',
          slug: 'test-server-1',
          provider: 'github',
          connection_status: 'connected'
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Test Server 2',
          slug: 'test-server-2',
          provider: null,
          connection_status: 'available'
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockServers)
      });

      const servers = await sdk.listServers();

      expect(servers).toHaveLength(2);
      expect(servers[0]).toBeInstanceOf(ServerSummary);
      expect(servers[0].id).toBe(mockServers[0].id);
      expect(servers[1]).toBeInstanceOf(ServerSummary);
      expect(servers[1].provider).toBeNull();

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/servers',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${validToken}`
          })
        })
      );
    });

    test('handles empty server list', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([])
      });

      const servers = await sdk.listServers();
      expect(servers).toEqual([]);
    });
  });

  describe('getServer', () => {
    test('returns ServerDetail object', async () => {
      const serverId = '123e4567-e89b-12d3-a456-426614174000';
      const mockServer = {
        id: serverId,
        name: 'Test Server',
        slug: 'test-server',
        provider: 'github',
        connection_status: 'connected',
        url: 'https://api.example.com/mcp'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockServer)
      });

      const server = await sdk.getServer(serverId);

      expect(server).toBeInstanceOf(ServerDetail);
      expect(server.id).toBe(serverId);
      expect(server.url).toBe(mockServer.url);

      expect(fetch).toHaveBeenCalledWith(
        `https://api.example.com/servers/${serverId}`,
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    test('validates server ID format', async () => {
      await expect(sdk.getServer('invalid-uuid'))
        .rejects.toThrow('Server ID must be a valid UUID');
      
      await expect(sdk.getServer(''))
        .rejects.toThrow('Server ID must be a non-empty string');
    });
  });

  describe('initiateConnection', () => {
    const serverId = '123e4567-e89b-12d3-a456-426614174000';

    test('initiates connection without return URL', async () => {
      const mockResponse = {
        connection_id: 'conn-123',
        auth_url: 'https://auth.example.com/oauth/authorize?...',
        state: 'random-state'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await sdk.initiateConnection(serverId);

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        `https://api.example.com/servers/${serverId}/connect`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({})
        })
      );
    });

    test('initiates connection with return URL', async () => {
      const returnUrl = 'https://app.example.com/callback';
      const mockResponse = { auth_url: 'https://auth.example.com/...' };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      await sdk.initiateConnection(serverId, returnUrl);

      expect(fetch).toHaveBeenCalledWith(
        `https://api.example.com/servers/${serverId}/connect?return_url=${encodeURIComponent(returnUrl)}`,
        expect.any(Object)
      );
    });

    test('handles OAuth configuration error', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('OAuth server configuration not found')
      });

      await expect(sdk.initiateConnection(serverId))
        .rejects.toThrow('Server is missing OAuth configuration');
    });
  });

  describe('getConnectionStatus', () => {
    test('returns connection status', async () => {
      const serverId = '123e4567-e89b-12d3-a456-426614174000';
      const mockResponse = { status: 'connected' };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const status = await sdk.getConnectionStatus(serverId);

      expect(status).toBe('connected');
      expect(fetch).toHaveBeenCalledWith(
        `https://api.example.com/servers/${serverId}/connection`,
        expect.objectContaining({
          method: 'GET'
        })
      );
    });
  });

  describe('cleanup', () => {
    test('close() prevents further requests', async () => {
      await sdk.close();
      
      await expect(sdk.listServers())
        .rejects.toThrow('SDK has been closed');
    });

    test('aclose() is alias for close()', async () => {
      await sdk.aclose();
      expect(sdk._closed).toBe(true);
    });
  });
});
