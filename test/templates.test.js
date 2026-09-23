/**
 * Guards for the five vendored mustache templates.
 *
 * These are the highest-value tests in the package and the reason it has any.
 * `templateDir` overrides WHOLE FILES, so when a generator upgrade changes one
 * of them upstream and nobody re-diffs, the old copy keeps winning — silently,
 * with no error, no type failure and no signal of any kind. Every vendored file
 * says "re-diff on upgrade" in its header; this is what makes that enforceable.
 *
 * They assert on generated OUTPUT rather than on template source, because the
 * question is never "does the template contain this line" but "does the SDK a
 * consumer installs behave this way".
 *
 * Requires `make gen-sdk-typescript` and a build first.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test, describe } from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const json = path => JSON.parse(read(path));

describe('apis.mustache — the OAuth authorization header', () => {
  // Any generated API class will do; they all come from the same template.
  const api = read('src/apis/RegistryApi.ts');

  test('oauth2 tokens are given the Bearer prefix', () => {
    // Upstream assigns the token raw for oauth2 — only the http/bearer scheme
    // gets a prefix. Our spec declares both as alternatives, so without this
    // an OAuth caller sends `Authorization: <token>` and is rejected.
    assert.match(api, /oauthToken\.startsWith\("Bearer "\) \? oauthToken : `Bearer \$\{oauthToken\}`/);
  });

  test('an empty token does not clobber the header', () => {
    // The generator emits one auth block per scheme AND per flow, all writing
    // the same header. Unguarded, a scheme returning "" wipes out the
    // credential a previous block just set.
    assert.match(api, /const oauthToken = await this\.configuration\.accessToken\([^)]*\);\s*\n\s*if \(oauthToken\) \{/);
  });
});

describe('runtime.mustache — OAuth endpoints from the spec', () => {
  const runtime = read('src/runtime.ts');

  test('the issuer is emitted and not empty', () => {
    // An empty value here is the fail-open case: it reaches an OIDC discovery
    // call as "" rather than failing to compile.
    const match = runtime.match(/export const OAUTH_ISSUER = "([^"]*)"/);
    assert.ok(match, 'OAUTH_ISSUER is missing — is x-issuer still on the OAuth2 scheme?');
    assert.notEqual(match[1], '', 'OAUTH_ISSUER is empty');
  });

  test('both flow endpoints are emitted under the issuer', () => {
    const issuer = runtime.match(/export const OAUTH_ISSUER = "([^"]*)"/)[1];
    for (const name of ['OAUTH_AUTHORIZATION_URL', 'OAUTH_TOKEN_URL']) {
      const match = runtime.match(new RegExp(`export const ${name} = "([^"]*)"`));
      assert.ok(match, `${name} is missing`);
      assert.ok(match[1].startsWith(issuer), `${name} does not sit under the issuer: ${match[1]}`);
    }
  });

  test('the base path comes from the spec, not localhost', () => {
    // With no `servers` block the generator bakes in http://localhost.
    const match = read('src/runtime.ts').match(/export const BASE_PATH = "([^"]*)"/);
    assert.ok(match);
    assert.ok(!match[1].includes('localhost'), `BASE_PATH fell back to ${match[1]}`);
  });
});

describe('tsconfig.mustache — the package checks itself honestly', () => {
  const { compilerOptions } = json('tsconfig.json');

  test('strict is on', () => {
    // Upstream emits it only under a redux feature flag, so the package built
    // non-strict: `npm run build` accepted code every manual check rejected.
    assert.equal(compilerOptions.strict, true);
  });

  test('the target matches the declared engine', () => {
    assert.equal(compilerOptions.target, 'es2022');
  });

  test('esModuleInterop is on', () => {
    // Without it @modelcontextprotocol/sdk's zod dependency does not compile.
    assert.equal(compilerOptions.esModuleInterop, true);
  });
});

describe('package.mustache — what consumers install', () => {
  const pkg = json('package.json');

  test('runtime dependencies are declared', () => {
    // No config option can add these, which is the whole reason the template
    // is vendored.
    for (const dep of ['openid-client', '@modelcontextprotocol/sdk']) {
      assert.ok(pkg.dependencies?.[dep], `${dep} is not declared`);
    }
  });

  test('@types/node is declared', () => {
    // src/lib/cli.ts uses node:http. Undeclared, the build passes only on a
    // machine that already has the types on disk.
    assert.ok(pkg.devDependencies?.['@types/node']);
  });

  test('both module formats and the cli subpath are exported', () => {
    assert.ok(pkg.exports['.'].import);
    assert.ok(pkg.exports['.'].require);
    assert.ok(pkg.exports['./cli'], 'the /cli subpath is missing — node:http would reach browser bundles');
  });
});

describe('index.mustache — the hand-written half is reachable', () => {
  test('the package root re-exports src/lib', () => {
    assert.match(read('src/index.ts'), /export \* from '\.\/lib\/index/);
  });

  test('the root does NOT re-export cli', () => {
    // It binds a port and spawns a browser; exporting it from the root would
    // drag node:http into every browser bundle.
    assert.doesNotMatch(read('src/index.ts'), /lib\/cli/);
  });
});

describe('importFileExtension — the ESM build actually loads', () => {
  test('relative imports carry an extension', async () => {
    // Extensionless imports type-check fine and fail only at runtime, with
    // ERR_MODULE_NOT_FOUND against the entry point package.json advertises as
    // `module`. Importing it is the only way to catch that.
    await import('../dist/esm/index.js');
  });

  test('the CommonJS build loads too', async () => {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const cjs = require('../dist/index.js');
    assert.equal(typeof cjs.createClient, 'function');
  });
});
