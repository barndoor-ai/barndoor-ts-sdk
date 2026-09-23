/**
 * Non-production overrides.
 *
 * Production needs nothing here: the generated client already carries the
 * production base URL (from the spec's `servers` block, baked into `BASE_PATH`)
 * and the production OAuth endpoints (from the `OAuth2` security scheme, emitted
 * as `OAUTH_ISSUER` / `OAUTH_TOKEN_URL` / `OAUTH_AUTHORIZATION_URL`). Both come
 * from docs/api/public-openapi.yaml, so neither is restated here.
 *
 * Only the other environments need declaring, because one spec cannot describe
 * several deployments.
 */
import { OAUTH_ISSUER as PRODUCTION_ISSUER } from '../runtime.js';

export interface Environment {
  /** OIDC issuer, for discovery. */
  issuer: string;
  /** API base URL, passed to the generated `Configuration` as `basePath`. */
  baseUrl: string;
}

export const DEV: Environment = {
  issuer: 'https://auth.barndoordev.com/realms/barndoor',
  baseUrl: 'https://platform.barndoordev.com',
};

/**
 * Local Tilt. The host carries an `mcp.` prefix rather than `platform.`, which
 * is why the spec's `servers` variable is the whole host and not a domain
 * suffix — see charts/barndoor/values.yaml.
 */
export const LOCAL: Environment = {
  issuer: 'https://auth.barndoorlocal.com/realms/barndoor',
  baseUrl: 'https://mcp.barndoorlocal.com',
};

/**
 * Read an environment from process environment variables.
 *
 * Opt-in on purpose. The SDK never reads `process.env` by itself: it is not
 * available in a browser, and a library that quietly re-points itself at another
 * cluster because of a variable set for some unrelated reason is a bad
 * surprise. Callers who want the behaviour ask for it:
 *
 *     createClient({ auth, env: environmentFromEnv() })
 *
 * `BARNDOOR_ENV` selects a known environment (`dev` or `local`; anything else,
 * including unset, means production). `BARNDOOR_API_URL` overrides the base URL
 * independently, for a deployment this SDK does not know about.
 *
 * Returns `undefined` for production, which is what `createClient` wants when
 * it should fall back to the generated defaults.
 */
/**
 * `process.env`, or an empty object off-Node.
 *
 * Reached through `globalThis` rather than the `process` global so the package
 * needs no `@types/node`, which a browser consumer should not have to install.
 */
function processEnv(): Record<string, string | undefined> {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
}

export function environmentFromEnv(
  source: Record<string, string | undefined> = processEnv()
): Environment | undefined {
  const named = source['BARNDOOR_ENV']?.trim().toLowerCase();
  const base = named === 'dev' ? DEV : named === 'local' ? LOCAL : undefined;

  const url = source['BARNDOOR_API_URL']?.trim();
  if (!url) return base;

  // A bare URL override still needs an issuer, and production's is the only one
  // the SDK knows without being told.
  return { issuer: base?.issuer ?? PRODUCTION_ISSUER, baseUrl: url };
}
