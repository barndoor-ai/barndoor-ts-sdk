/**
 * Tests for the main BarndoorSDK client.
 */

import * as SDK from '../dist/index.esm.js';
const { BarndoorSDK, ServerSummary, ServerDetail, HTTPError, ConfigurationError, TokenError } = SDK;

// Mock fetch
const mockFetch = {
  fn: () => {},
  mockResolvedValueOnce: value => {
    mockFetch.fn = () => Promise.resolve(value);
    return mockFetch;
  },
  mockRejectedValueOnce: error => {
    mockFetch.fn = () => Promise.reject(error);
    return mockFetch;
  },
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
  mockFetch.mockClear();
});

describe('BarndoorSDK Constructor', () => {
  const validToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

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

  test.skip('methods throw when token not provided', async () => {
    const sdk = new BarndoorSDK('https://api.example.com');
    await expect(sdk.listServers()).rejects.toThrow('No token available. Call authenticate() first or provide token in constructor.');
  });

  test('throws when empty token is provided', () => {
    expect(() => new BarndoorSDK('https://api.example.com', { token: '' })).toThrow(TokenError);
  });

  test('validates URL format', () => {
    expect(() => new BarndoorSDK('invalid-url', { token: validToken })).toThrow(ConfigurationError);

    expect(() => new BarndoorSDK('', { token: validToken })).toThrow(ConfigurationError);
  });

  test('validates token format', () => {
    expect(() => new BarndoorSDK('https://api.example.com', { token: '' })).toThrow(TokenError);

    expect(() => new BarndoorSDK('https://api.example.com', { token: 'invalid-jwt' })).toThrow(
      TokenError
    );
  });

  test('validates timeout parameter', () => {
    expect(
      () =>
        new BarndoorSDK('https://api.example.com', {
          token: validToken,
          timeout: -1,
        })
    ).toThrow(ConfigurationError);

    expect(
      () =>
        new BarndoorSDK('https://api.example.com', {
          token: validToken,
          timeout: 'invalid',
        })
    ).toThrow(ConfigurationError);
  });

  test('validates maxRetries parameter', () => {
    expect(
      () =>
        new BarndoorSDK('https://api.example.com', {
          token: validToken,
          maxRetries: -1,
        })
    ).toThrow(ConfigurationError);

    expect(
      () =>
        new BarndoorSDK('https://api.example.com', {
          token: validToken,
          maxRetries: 1.5,
        })
    ).toThrow(ConfigurationError);
  });
});

describe('BarndoorSDK Methods', () => {
  const validToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  let sdk;

  beforeEach(() => {
    // Mock environment to skip token validation
    process.env.BARNDOOR_ENV = 'test';
    sdk = new BarndoorSDK('https://api.example.com', { token: validToken });
  });

  afterEach(async () => {
    if (sdk && typeof sdk.close === 'function') {
      await sdk.close();
    }
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
          connection_status: 'connected',
        },
        {
          id: '123e4567-e89b-12d3-a456-426614174001',
          name: 'Test Server 2',
          slug: 'test-server-2',
          provider: null,
          connection_status: 'available',
        },
      ];

      const mockPaginatedResponse = {
        data: mockServers,
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          pages: 1,
          previous_page: null,
          next_page: null,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPaginatedResponse),
      });

      const servers = await sdk.listServers();

      expect(servers).toHaveLength(2);
      expect(servers[0]).toBeInstanceOf(ServerSummary);
      expect(servers[0].id).toBe(mockServers[0].id);
      expect(servers[1]).toBeInstanceOf(ServerSummary);
      expect(servers[1].provider).toBeNull();

      expect(mockFetch.calls.length).toBe(1);
      expect(mockFetch.calls[0][0]).toBe('https://api.example.com/servers');
      expect(mockFetch.calls[0][1]).toEqual(
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${validToken}`,
          }),
        })
      );
    });

    test('handles empty server list', async () => {
      const mockEmptyResponse = {
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          pages: 0,
          previous_page: null,
          next_page: null,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEmptyResponse),
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
        url: 'https://api.example.com/mcp',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockServer),
      });

      const server = await sdk.getServer(serverId);

      expect(server).toBeInstanceOf(ServerDetail);
      expect(server.id).toBe(serverId);
      expect(server.url).toBe(mockServer.url);

      expect(mockFetch.calls[0][0]).toBe(`https://api.example.com/servers/${serverId}`);
      expect(mockFetch.calls[0][1]).toEqual(expect.objectContaining({ method: 'GET' }));
    });

    test('validates server ID format', async () => {
      await expect(sdk.getServer('invalid_uuid!')).rejects.toThrow(
        'Server ID must be a valid UUID or slug'
      );

      await expect(sdk.getServer('')).rejects.toThrow('Server ID must be a non-empty string');
    });
  });

  describe('initiateConnection', () => {
    const serverId = '123e4567-e89b-12d3-a456-426614174000';

    test('initiates connection without return URL', async () => {
      const mockResponse = {
        connection_id: 'conn-123',
        auth_url: 'https://auth.example.com/oauth/authorize?...',
        state: 'random-state',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await sdk.initiateConnection(serverId);

      expect(result).toEqual(mockResponse);
      expect(mockFetch.calls.length).toBe(1);
      expect(mockFetch.calls[0][0]).toBe(`https://api.example.com/servers/${serverId}/connect`);
      expect(mockFetch.calls[0][1]).toEqual(
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({}),
        })
      );
    });

    test('initiates connection with return URL', async () => {
      const returnUrl = 'https://app.example.com/callback';
      const mockResponse = { auth_url: 'https://auth.example.com/...' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await sdk.initiateConnection(serverId, returnUrl);

      expect(mockFetch.calls.length).toBe(1);
      expect(mockFetch.calls[0][0]).toBe(
        `https://api.example.com/servers/${serverId}/connect?return_url=${encodeURIComponent(returnUrl)}`
      );
      expect(mockFetch.calls[0][1]).toEqual(expect.any(Object));
    });

    test('handles OAuth configuration error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('OAuth server configuration not found'),
      });

      await expect(sdk.initiateConnection(serverId)).rejects.toThrow(
        'Server is missing OAuth configuration'
      );
    });
  });

  describe('getConnectionStatus', () => {
    test('returns connection status', async () => {
      const serverId = '123e4567-e89b-12d3-a456-426614174000';
      const mockResponse = { status: 'connected' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const status = await sdk.getConnectionStatus(serverId);

      expect(status).toBe('connected');
      expect(mockFetch.calls.length).toBe(1);
      expect(mockFetch.calls[0][0]).toBe(`https://api.example.com/servers/${serverId}/connection`);
      expect(mockFetch.calls[0][1]).toEqual(
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
  });

  describe('disconnectServer', () => {
    const serverId = '123e4567-e89b-12d3-a456-426614174000';

    test('successfully disconnects from server', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      await sdk.disconnectServer(serverId);

      expect(mockFetch.calls.length).toBe(1);
      expect(mockFetch.calls[0][0]).toBe(`https://api.example.com/servers/${serverId}/connection`);
      expect(mockFetch.calls[0][1]).toEqual(
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    test('throws error when connection not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () =>
          Promise.resolve({
            error: 'ConnectionNotFound',
            message: 'Connection not found',
          }),
      });

      await expect(sdk.disconnectServer(serverId)).rejects.toThrow(/Connection not found/i);
    });

    test('validates server ID format', async () => {
      await expect(sdk.disconnectServer('invalid_server_id!')).rejects.toThrow(
        'Server ID must be a valid UUID or slug'
      );
    });
  });

  describe('cleanup', () => {
    test.skip('close() prevents further requests - edge case', async () => {
      await sdk.close();

      await expect(sdk.listServers()).rejects.toThrow('SDK has been closed. Create a new instance or use as context manager.');
    });

    test('aclose() is alias for close()', async () => {
      await sdk.aclose();
      expect(sdk._closed).toBe(true);
    });
  });
});
