/**
 * Token lifecycle: caching, single-flight, and recovery from a failed discovery.
 *
 * Driven against a stub IdP through the `fetch` seam rather than a mock, so the
 * real openid-client code path runs.
 */
import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';

import { clientCredentials, staticToken } from '../dist/esm/index.js';

const ISSUER = 'https://idp.test/realms/x';

/**
 * A stub authorization server: OIDC metadata plus a token endpoint.
 *
 * `plan` controls each response — `{ fail: true }` rejects, otherwise the token
 * is minted with the given `expiresIn`.
 */
function stubIdp(plan = {}) {
  const counts = { discovery: 0, token: 0 };
  let step = 0;

  const fetch = async (url, options = {}) => {
    const href = String(url);
    if (href.includes('.well-known')) {
      counts.discovery++;
      if (plan.discoveryFails?.(counts.discovery)) throw new TypeError('idp unreachable');
      return new Response(
        JSON.stringify({
          issuer: ISSUER,
          token_endpoint: `${ISSUER}/token`,
          authorization_endpoint: `${ISSUER}/auth`,
          jwks_uri: `${ISSUER}/certs`,
          response_types_supported: ['code'],
          grant_types_supported: ['client_credentials', 'refresh_token', 'authorization_code'],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    counts.token++;
    const expiresIn = Array.isArray(plan.expiresIn) ? plan.expiresIn[step++] : plan.expiresIn;
    const body = { access_token: `token-${counts.token}`, token_type: 'bearer' };
    if (expiresIn !== undefined) body.expires_in = expiresIn;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  return { fetch, counts };
}

const provider = (idp, overrides = {}) =>
  clientCredentials({ clientId: 'id', clientSecret: 'secret', issuer: ISSUER, fetch: idp.fetch, ...overrides });

describe('staticToken', () => {
  test('returns what it was given, every time', async () => {
    const getToken = staticToken('bdai_abc');
    assert.equal(await getToken(), 'bdai_abc');
    assert.equal(await getToken(), 'bdai_abc');
  });
});

describe('caching', () => {
  test('a live token is reused rather than re-fetched', async () => {
    const idp = stubIdp({ expiresIn: 3600 });
    const getToken = provider(idp);

    assert.equal(await getToken(), 'token-1');
    assert.equal(await getToken(), 'token-1');
    assert.equal(idp.counts.token, 1);
  });

  test('discovery runs once, not per token', async () => {
    const idp = stubIdp({ expiresIn: 0 });
    const getToken = provider(idp);
    await getToken();
    await getToken();

    assert.equal(idp.counts.token, 2, 'a dead token is re-fetched');
    assert.equal(idp.counts.discovery, 1, 'but the metadata is not');
  });

  test('expires_in 0 means expired, not never-expires', async () => {
    // 0 is falsy, so a truthiness check would cache a dead token forever.
    const idp = stubIdp({ expiresIn: 0 });
    const getToken = provider(idp);

    assert.equal(await getToken(), 'token-1');
    assert.equal(await getToken(), 'token-2', 'the token should have been treated as expired');
  });

  test('an absent expires_in is treated as unknown, not as expired', async () => {
    // Otherwise every API call would mint a fresh token.
    const idp = stubIdp({});
    const getToken = provider(idp);

    assert.equal(await getToken(), 'token-1');
    assert.equal(await getToken(), 'token-1');
    assert.equal(idp.counts.token, 1);
  });

  test('a token inside the skew window is refreshed early', async () => {
    // 30s of life is less than the 60s skew, so it is already unusable.
    const idp = stubIdp({ expiresIn: 30 });
    const getToken = provider(idp);

    assert.equal(await getToken(), 'token-1');
    assert.equal(await getToken(), 'token-2');
  });
});

describe('single-flight', () => {
  test('parallel callers share one token request', async () => {
    // Every generated operation calls this hook, so a burst of parallel API
    // calls would otherwise stampede the IdP with one token request each.
    const idp = stubIdp({ expiresIn: 3600 });
    const getToken = provider(idp);

    const tokens = await Promise.all(Array.from({ length: 10 }, () => getToken()));

    assert.equal(idp.counts.token, 1);
    assert.deepEqual(new Set(tokens), new Set(['token-1']));
  });
});

describe('recovery', () => {
  test('a failed discovery does not poison the provider', async () => {
    // `configuration ??= discovery(...)` memoises the PROMISE. Without clearing
    // it on rejection, one transient IdP blip is replayed forever and only a
    // process restart recovers.
    const idp = stubIdp({ expiresIn: 3600, discoveryFails: attempt => attempt === 1 });
    const getToken = provider(idp);

    await assert.rejects(() => getToken(), /idp unreachable/);
    assert.equal(await getToken(), 'token-1', 'the next call should recover');
  });

  test('discovery is still cached after it succeeds', async () => {
    const idp = stubIdp({ expiresIn: 0, discoveryFails: attempt => attempt === 1 });
    const getToken = provider(idp);

    await assert.rejects(() => getToken());
    await getToken();
    await getToken();

    assert.equal(idp.counts.discovery, 2, 'one failure, one success, then reused');
  });

  test('a failed token request does not wedge later calls', async () => {
    let failNext = true;
    const idp = stubIdp({ expiresIn: 3600 });
    const flaky = async (url, options) => {
      if (!String(url).includes('.well-known') && failNext) {
        failNext = false;
        throw new TypeError('token endpoint down');
      }
      return idp.fetch(url, options);
    };
    const getToken = clientCredentials({ clientId: 'id', clientSecret: 's', issuer: ISSUER, fetch: flaky });

    await assert.rejects(() => getToken());
    assert.ok(await getToken(), 'the in-flight slot must be released on failure');
  });
});
