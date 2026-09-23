/**
 * Client assembly, MCP URL composition, and environment selection.
 */
import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';

import {
  createClient,
  environmentFromEnv,
  mcpConnectionParams,
  DEV,
  LOCAL,
} from '../dist/esm/index.js';
import { BASE_PATH } from '../dist/esm/runtime.js';

const ORG = 'acme';

describe('createClient', () => {
  test('exposes every generated API class', () => {
    const bd = createClient({ auth: 'tok' });
    for (const name of ['registry', 'policy', 'identity', 'notification', 'dlp', 'llmGateway', 'systemManagement']) {
      assert.ok(bd[name], `${name} is missing`);
    }
  });

  test('production needs no base URL — the generated default is used', () => {
    const bd = createClient({ auth: 'tok' });
    assert.equal(bd.configuration.basePath, BASE_PATH);
  });

  test('an environment overrides the base URL', () => {
    assert.equal(createClient({ auth: 'tok', env: DEV }).configuration.basePath, DEV.baseUrl);
    assert.equal(createClient({ auth: 'tok', env: LOCAL }).configuration.basePath, LOCAL.baseUrl);
  });

  test('a token string becomes a provider the generated hook can call', async () => {
    const bd = createClient({ auth: 'bdai_abc' });
    assert.equal(await bd.configuration.accessToken('ApiKey', []), 'bdai_abc');
  });

  test('a caller-supplied provider is used as given', async () => {
    const bd = createClient({ auth: async () => 'from-provider' });
    assert.equal(await bd.configuration.accessToken('ApiKey', []), 'from-provider');
  });

  test('retries are on by default and can be switched off', () => {
    // Forgetting fetchApi fails invisibly — the client just gets less
    // resilient — so the default must be on.
    assert.ok(createClient({ auth: 'tok' }).configuration.fetchApi, 'retries should default on');
    assert.equal(createClient({ auth: 'tok', retry: false }).configuration.fetchApi, undefined);
  });

  test('middleware and headers reach the configuration', () => {
    // These are the extension points that stand in for a built-in logger.
    const middleware = [{ pre: async () => undefined }];
    const bd = createClient({ auth: 'tok', middleware, headers: { 'x-test': '1' } });

    assert.deepEqual(bd.configuration.middleware, middleware);
    assert.equal(bd.configuration.headers['x-test'], '1');
  });
});

describe('MCP connection parameters', () => {
  const bd = createClient({ auth: 'tok' });

  test('omitting a server gives the universal endpoint', async () => {
    const { url } = await mcpConnectionParams(bd, ORG);
    assert.equal(url, `https://${ORG}.platform.barndoor.ai/mcp`);
  });

  test('naming a server gives the direct endpoint', async () => {
    const { url } = await mcpConnectionParams(bd, ORG, 'slack-user');
    assert.equal(url, `https://${ORG}.platform.barndoor.ai/mcp/slack-user`);
  });

  test('the organization becomes a subdomain of the API host', async () => {
    const bdDev = createClient({ auth: 'tok', env: DEV });
    const { url } = await mcpConnectionParams(bdDev, ORG);
    assert.equal(new URL(url).hostname, `${ORG}.${new URL(DEV.baseUrl).hostname}`);
  });

  test('an explicit baseUrl overrides the client host', async () => {
    const { url } = await mcpConnectionParams(bd, ORG, undefined, { baseUrl: 'https://mcp.elsewhere.test' });
    assert.equal(url, `https://${ORG}.mcp.elsewhere.test/mcp`);
  });

  test('a missing organization is rejected rather than producing a bare host', async () => {
    await assert.rejects(() => mcpConnectionParams(bd, ''), /organization slug is required/);
  });

  test('headers carry a prefixed bearer, a session id and the SSE accept type', async () => {
    const { headers } = await mcpConnectionParams(bd, ORG, 'slack-user');

    assert.equal(headers.Authorization, 'Bearer tok');
    assert.equal(headers.Accept, 'application/json, text/event-stream');
    assert.ok(headers['x-barndoor-session-id']);
  });

  test('a caller-supplied session id is used verbatim', async () => {
    const { headers } = await mcpConnectionParams(bd, ORG, undefined, { sessionId: 'fixed-session' });
    assert.equal(headers['x-barndoor-session-id'], 'fixed-session');
  });

  test('each session gets its own id by default', async () => {
    const a = await mcpConnectionParams(bd, ORG);
    const b = await mcpConnectionParams(bd, ORG);
    assert.notEqual(a.headers['x-barndoor-session-id'], b.headers['x-barndoor-session-id']);
  });

  test('a slug is passed through without an API call', async () => {
    // Only a UUID needs exchanging, so a slug must not cost a round trip. This
    // client has no working transport, so a request would throw.
    const { url } = await mcpConnectionParams(bd, ORG, 'not-a-uuid');
    assert.match(url, /\/mcp\/not-a-uuid$/);
  });
});

describe('environmentFromEnv', () => {
  test('unset means production, which is undefined', () => {
    assert.equal(environmentFromEnv({}), undefined);
  });

  test('named environments resolve', () => {
    assert.deepEqual(environmentFromEnv({ BARNDOOR_ENV: 'dev' }), DEV);
    assert.deepEqual(environmentFromEnv({ BARNDOOR_ENV: 'LOCAL' }), LOCAL);
    assert.deepEqual(environmentFromEnv({ BARNDOOR_ENV: ' dev ' }), DEV);
  });

  test('an unknown name falls back to production rather than throwing', () => {
    assert.equal(environmentFromEnv({ BARNDOOR_ENV: 'staging' }), undefined);
  });

  test('a URL override keeps the matching issuer', () => {
    const env = environmentFromEnv({ BARNDOOR_ENV: 'dev', BARNDOOR_API_URL: 'https://other.test' });
    assert.equal(env.baseUrl, 'https://other.test');
    assert.equal(env.issuer, DEV.issuer, 'the issuer must follow the named environment');
  });

  test('a URL override alone uses the production issuer', () => {
    const env = environmentFromEnv({ BARNDOOR_API_URL: 'https://other.test' });
    assert.equal(env.baseUrl, 'https://other.test');
    assert.ok(env.issuer.startsWith('https://'), 'a bare override still needs an issuer');
  });
});
