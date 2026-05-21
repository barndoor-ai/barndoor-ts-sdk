/**
 * Tests for OAuth client-credentials (M2M) support.
 */

import * as SDK from '../dist/index.esm.js';
const { BarndoorSDK, getClientCredentialsToken, OAuthError, HTTPError } = SDK;

// JWT helper — produces an unsigned-looking JWT with the given exp offset.
function makeJwt(expSecondsFromNow) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' }))
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })
  )
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${header}.${payload}.sig`;
}

// Mock fetch with queue support.
const mockFetch = {
  responseQueue: [],
  calls: [],
  mockResolvedValueOnce(value) {
    this.responseQueue.push({ type: 'resolve', value });
    return this;
  },
  mockRejectedValueOnce(error) {
    this.responseQueue.push({ type: 'reject', value: error });
    return this;
  },
  mockClear() {
    this.responseQueue = [];
    this.calls = [];
  },
};

const realFetch = global.fetch;

beforeEach(() => {
  mockFetch.mockClear();
  global.fetch = (...args) => {
    mockFetch.calls.push(args);
    if (mockFetch.responseQueue.length > 0) {
      const r = mockFetch.responseQueue.shift();
      return r.type === 'resolve' ? Promise.resolve(r.value) : Promise.reject(r.value);
    }
    return Promise.reject(new Error('No mock response queued'));
  };
  process.env.BARNDOOR_ENV = 'test';
});

afterEach(() => {
  global.fetch = realFetch;
  delete process.env.BARNDOOR_ENV;
});

// Helpers to mock the OIDC discovery + token endpoint pair.
function queueOidcDiscovery(issuer, tokenEndpoint) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    headers: { get: () => 'application/json' },
    json: () =>
      Promise.resolve({
        issuer,
        token_endpoint: tokenEndpoint,
        authorization_endpoint: `${issuer}/authorize`,
        userinfo_endpoint: `${issuer}/userinfo`,
        jwks_uri: `${issuer}/jwks`,
      }),
    text: () => Promise.resolve(''),
  });
}

function queueTokenResponse(token, ok = true, body = {}) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 400,
    statusText: ok ? 'OK' : 'Bad Request',
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(ok ? { access_token: token } : body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

describe('getClientCredentialsToken', () => {
  test('posts grant against discovered token endpoint and returns access_token', async () => {
    SDK.clearOidcConfigCache();
    queueOidcDiscovery('https://issuer.test', 'https://issuer.test/token');
    queueTokenResponse('abc.def.ghi');

    const token = await getClientCredentialsToken({
      clientId: 'cid',
      clientSecret: 'csec',
      audience: 'https://barndoor.ai/',
      issuer: 'https://issuer.test',
    });

    expect(token).toBe('abc.def.ghi');

    // Second call is the token grant.
    const [url, init] = mockFetch.calls[1];
    expect(url).toBe('https://issuer.test/token');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    const params = new URLSearchParams(init.body);
    expect(params.get('grant_type')).toBe('client_credentials');
    expect(params.get('client_id')).toBe('cid');
    expect(params.get('client_secret')).toBe('csec');
    expect(params.get('audience')).toBe('https://barndoor.ai/');
  });

  test('falls back to https://{domain}/oauth/token when no issuer is given', async () => {
    queueTokenResponse('tok');

    const token = await getClientCredentialsToken({
      clientId: 'cid',
      clientSecret: 'csec',
      audience: 'https://barndoor.ai/',
      domain: 'auth.example.com',
    });

    expect(token).toBe('tok');
    expect(mockFetch.calls[0][0]).toBe('https://auth.example.com/oauth/token');
  });

  test('throws OAuthError when neither issuer nor domain is given', async () => {
    await expect(
      getClientCredentialsToken({
        clientId: 'cid',
        clientSecret: 'csec',
        audience: 'https://barndoor.ai/',
      })
    ).rejects.toThrow(OAuthError);
  });

  test('throws OAuthError on non-2xx token response', async () => {
    queueTokenResponse('', false, { error: 'invalid_client' });

    await expect(
      getClientCredentialsToken({
        clientId: 'cid',
        clientSecret: 'wrong',
        audience: 'https://barndoor.ai/',
        domain: 'auth.example.com',
      })
    ).rejects.toThrow(/invalid_client/);
  });
});

describe('BarndoorSDK.fromClientCredentials', () => {
  test('fetches a token and produces a working SDK instance', async () => {
    SDK.clearOidcConfigCache();
    queueOidcDiscovery('https://issuer.test', 'https://issuer.test/token');
    queueTokenResponse(makeJwt(3600));

    const sdk = await BarndoorSDK.fromClientCredentials('https://api.example.com', {
      clientId: 'cid',
      clientSecret: 'csec',
      audience: 'https://barndoor.ai/',
      issuer: 'https://issuer.test',
    });

    try {
      expect(sdk.token).toMatch(/\./);
      expect(sdk.base).toBe('https://api.example.com');
    } finally {
      await sdk.close();
    }
  });

  test('refreshes near-expiry token before next request', async () => {
    SDK.clearOidcConfigCache();
    const stale = makeJwt(10); // within 60s skew
    const fresh = makeJwt(3600);

    queueOidcDiscovery('https://issuer.test', 'https://issuer.test/token');
    queueTokenResponse(stale);

    const sdk = await BarndoorSDK.fromClientCredentials('https://api.example.com', {
      clientId: 'cid',
      clientSecret: 'csec',
      audience: 'https://barndoor.ai/',
      issuer: 'https://issuer.test',
    });

    try {
      // Refresh issues another token grant; OIDC config is cached so no
      // second discovery call.
      queueTokenResponse(fresh);
      // Then the API request itself.
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () =>
          Promise.resolve({
            data: [],
            pagination: {
              page: 1,
              limit: 10,
              total: 0,
              pages: 1,
              previous_page: null,
              next_page: null,
            },
          }),
        text: () => Promise.resolve(''),
      });

      const servers = await sdk.listServers();
      expect(servers).toHaveLength(0);
      expect(sdk.token).toBe(fresh);

      // The API call must carry the refreshed bearer.
      const apiCall = mockFetch.calls.find(
        ([url]) => url === 'https://api.example.com/api/servers'
      );
      expect(apiCall).toBeDefined();
      expect(apiCall[1].headers.Authorization).toBe(`Bearer ${fresh}`);
    } finally {
      await sdk.close();
    }
  });

  test('retries exactly once on 401 with a refreshed token', async () => {
    SDK.clearOidcConfigCache();
    const first = makeJwt(3600);
    const second = makeJwt(3600);

    queueOidcDiscovery('https://issuer.test', 'https://issuer.test/token');
    queueTokenResponse(first);

    const sdk = await BarndoorSDK.fromClientCredentials('https://api.example.com', {
      clientId: 'cid',
      clientSecret: 'csec',
      audience: 'https://barndoor.ai/',
      issuer: 'https://issuer.test',
    });

    try {
      // First API call → 401.
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: { get: () => 'application/json' },
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({}),
      });
      // Refresh.
      queueTokenResponse(second);
      // Second (retried) API call succeeds.
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () =>
          Promise.resolve({
            data: [],
            pagination: {
              page: 1,
              limit: 10,
              total: 0,
              pages: 1,
              previous_page: null,
              next_page: null,
            },
          }),
        text: () => Promise.resolve(''),
      });

      const servers = await sdk.listServers();
      expect(servers).toHaveLength(0);
      expect(sdk.token).toBe(second);

      const apiCalls = mockFetch.calls.filter(
        ([url]) => url === 'https://api.example.com/api/servers'
      );
      expect(apiCalls).toHaveLength(2);
      expect(apiCalls[0][1].headers.Authorization).toBe(`Bearer ${first}`);
      expect(apiCalls[1][1].headers.Authorization).toBe(`Bearer ${second}`);
    } finally {
      await sdk.close();
    }
  });

  test('plain SDK without M2M credentials propagates 401 unchanged', async () => {
    const sdk = new BarndoorSDK('https://api.example.com', { token: makeJwt(3600) });

    try {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: { get: () => 'application/json' },
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({}),
      });

      await expect(sdk.listServers()).rejects.toThrow(HTTPError);

      const apiCalls = mockFetch.calls.filter(
        ([url]) => url === 'https://api.example.com/api/servers'
      );
      expect(apiCalls).toHaveLength(1);
    } finally {
      await sdk.close();
    }
  });
});
