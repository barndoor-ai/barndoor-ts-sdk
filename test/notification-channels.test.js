/**
 * Tests for the notification channel methods (BCP-3758).
 *
 * Covers the platform's public channel-management surface at
 * /api/notification/public/v1/channels. The emphasis is on what a caller can get wrong
 * and what a refactor could silently change:
 *
 * - the exact path and verb each method uses (a typo is a production 404 no type checker
 *   catches);
 * - that `subscriptions` is always sent, because the endpoint *replaces* rather than
 *   merges and an omitted key would silently mean "unsubscribe from everything";
 * - that only supplied destination fields are forwarded (padding with nulls is a 422);
 * - that a failed channel test is data (`ok: false`), not a thrown error;
 * - that DELETE survives a realistic 204 response, which the pre-existing
 *   disconnectServer test could not prove (its mock had no .json()).
 */

import * as SDK from '../dist/index.esm.js';
const { BarndoorSDK, HTTPError } = SDK;

const CHANNELS = 'https://api.example.com/api/notification/public/v1/channels';

const mockFetch = {
  responseQueue: [],
  fn: () => {},
  mockResolvedValueOnce: value => {
    mockFetch.responseQueue.push({ type: 'resolve', value });
    return mockFetch;
  },
  mockClear: () => {
    mockFetch.fn = () => {};
    mockFetch.calls = [];
    mockFetch.responseQueue = [];
  },
  calls: [],
};

global.fetch = (...args) => {
  mockFetch.calls.push(args);
  if (mockFetch.responseQueue.length > 0) {
    const response = mockFetch.responseQueue.shift();
    return response.type === 'resolve'
      ? Promise.resolve(response.value)
      : Promise.reject(response.value);
  }
  return mockFetch.fn(...args);
};

/** A 200 JSON response, shaped like a real fetch Response. */
const jsonResponse = body => ({
  ok: true,
  status: 200,
  headers: { get: name => (name.toLowerCase() === 'content-type' ? 'application/json' : '') },
  json: () => Promise.resolve(body),
});

/**
 * A realistic 204: no content-type, and .json() rejects the way a real Response does on
 * an empty body. If the client's 204 guard regresses, this surfaces it.
 */
const noContentResponse = () => ({
  ok: true,
  status: 204,
  headers: { get: () => '' },
  json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
  text: () => Promise.resolve(''),
});

const channelJson = (overrides = {}) => ({
  id: '11111111-1111-1111-1111-111111111111',
  type: 'webhook',
  enabled: true,
  user_id: null,
  email_address: null,
  url: 'https://hooks.example.com/barndoor',
  label: null,
  slack_channel_id: null,
  subscriptions: [{ alert_type: 'break_glass_used' }],
  created_at: '2026-08-26T00:00:00Z',
  updated_at: '2026-08-26T00:00:00Z',
  has_signing_secret: true,
  has_workflow_url: false,
  signing_secret: null,
  ...overrides,
});

beforeEach(() => {
  mockFetch.mockClear();
});

describe('Notification channels', () => {
  const validToken =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  let sdk;

  beforeEach(() => {
    process.env.BARNDOOR_ENV = 'test';
    sdk = new BarndoorSDK('https://api.example.com', { token: validToken });
  });

  afterEach(async () => {
    if (sdk && typeof sdk.close === 'function') {
      await sdk.close();
    }
    delete process.env.BARNDOOR_ENV;
  });

  describe('listChannels', () => {
    test('unwraps the data envelope', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: [channelJson()] }));

      const channels = await sdk.listChannels();

      expect(channels).toHaveLength(1);
      expect(channels[0].url).toBe('https://hooks.example.com/barndoor');
      expect(channels[0].subscriptions[0].alert_type).toBe('break_glass_used');
      expect(mockFetch.calls[0][0]).toBe(CHANNELS);
      expect(mockFetch.calls[0][1].method).toBe('GET');
    });

    test('returns [] for an empty or missing envelope', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: [] }));
      expect(await sdk.listChannels()).toEqual([]);

      mockFetch.mockResolvedValueOnce(jsonResponse({}));
      expect(await sdk.listChannels()).toEqual([]);
    });

    test('listUserChannels uses the /user path, not a filter', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ data: [channelJson({ type: 'in_app', url: null })] })
      );

      const channels = await sdk.listUserChannels();

      expect(channels[0].type).toBe('in_app');
      expect(mockFetch.calls[0][0]).toBe(`${CHANNELS}/user`);
    });
  });

  describe('getChannelOptions', () => {
    test('returns the alert vocabulary', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          alert_types: [
            {
              value: 'break_glass_used',
              label: 'Break-glass used',
              category: 'access_control',
              severity: 'critical',
            },
          ],
          categories: [{ value: 'access_control', label: 'Access control' }],
          severities: [{ value: 'critical', label: 'Critical' }],
        })
      );

      const options = await sdk.getChannelOptions();

      expect(options.alert_types[0].severity).toBe('critical');
      expect(mockFetch.calls[0][0]).toBe(`${CHANNELS}/options`);
    });
  });

  describe('upsertChannel', () => {
    const bodyOf = call => JSON.parse(call[1].body);

    test('creates without an id and preserves the one-time secret reveal', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(channelJson({ signing_secret: 'whsec_abc' })));

      const channel = await sdk.upsertChannel({
        type: 'webhook',
        url: 'https://hooks.example.com/barndoor',
        subscriptions: ['break_glass_used', 'policy_changed'],
      });

      expect(mockFetch.calls[0][0]).toBe(CHANNELS);
      expect(mockFetch.calls[0][1].method).toBe('PUT');

      const body = bodyOf(mockFetch.calls[0]);
      expect(body.id).toBeUndefined();
      expect(body.type).toBe('webhook');
      expect(body.subscriptions).toEqual([
        { alert_type: 'break_glass_used' },
        { alert_type: 'policy_changed' },
      ]);
      expect(channel.signing_secret).toBe('whsec_abc');
    });

    test('edit-by-id sends a trimmed id', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(channelJson({ enabled: false })));

      await sdk.upsertChannel({
        channelId: ' 22222222-2222-2222-2222-222222222222 ',
        type: 'webhook',
        url: 'https://hooks.example.com/barndoor',
        enabled: false,
      });

      const body = bodyOf(mockFetch.calls[0]);
      expect(body.id).toBe('22222222-2222-2222-2222-222222222222');
      expect(body.enabled).toBe(false);
    });

    test('always sends subscriptions, because the endpoint replaces rather than merges', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(channelJson({ subscriptions: [] })));

      await sdk.upsertChannel({ type: 'email', emailAddress: 'ops@example.com' });

      expect(bodyOf(mockFetch.calls[0]).subscriptions).toEqual([]);
    });

    test('forwards only the destination fields supplied', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(channelJson({ type: 'email', url: null })));

      await sdk.upsertChannel({ type: 'email', emailAddress: 'ops@example.com' });

      expect(Object.keys(bodyOf(mockFetch.calls[0])).sort()).toEqual([
        'email_address',
        'enabled',
        'subscriptions',
        'type',
      ]);
    });

    test('defaults enabled to true', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(channelJson()));

      await sdk.upsertChannel({ type: 'webhook', url: 'https://hooks.example.com/barndoor' });

      expect(bodyOf(mockFetch.calls[0]).enabled).toBe(true);
    });

    test('rejects a missing type', async () => {
      await expect(sdk.upsertChannel({ type: '' })).rejects.toThrow('Channel type');
    });

    test('rejects a blank channelId', async () => {
      await expect(sdk.upsertChannel({ type: 'webhook', channelId: '   ' })).rejects.toThrow(
        'Channel ID'
      );
    });
  });

  describe('deleteChannel', () => {
    test('survives a realistic 204 with no body', async () => {
      mockFetch.mockResolvedValueOnce(noContentResponse());

      await expect(sdk.deleteChannel('abc-123')).resolves.toBeUndefined();

      expect(mockFetch.calls[0][0]).toBe(`${CHANNELS}/abc-123`);
      expect(mockFetch.calls[0][1].method).toBe('DELETE');
    });

    test('rejects bad ids', async () => {
      await expect(sdk.deleteChannel('')).rejects.toThrow('Channel ID');
      await expect(sdk.deleteChannel('   ')).rejects.toThrow('Channel ID');
    });

    test('surfaces a 404 for an unknown channel', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Channel not found'),
      });

      await expect(sdk.deleteChannel('nope')).rejects.toThrow(HTTPError);
    });
  });

  describe('regenerateChannelSecret', () => {
    test('returns the rotated secret', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ signing_secret: 'whsec_rotated' }));

      const result = await sdk.regenerateChannelSecret('abc-123');

      expect(result.signing_secret).toBe('whsec_rotated');
      expect(mockFetch.calls[0][0]).toBe(`${CHANNELS}/abc-123/regenerate-secret`);
      expect(mockFetch.calls[0][1].method).toBe('POST');
    });
  });

  describe('testChannel', () => {
    test('success', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, error: null }));

      const result = await sdk.testChannel('abc-123');

      expect(result.ok).toBe(true);
      expect(mockFetch.calls[0][0]).toBe(`${CHANNELS}/abc-123/test`);
    });

    test('a transport failure is data, not a thrown error', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: false, error: 'connection refused' }));

      const result = await sdk.testChannel('abc-123');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('connection refused');
    });
  });
});
