import * as oidc from 'openid-client';

import { OAUTH_ISSUER } from '../runtime.js';

/**
 * Supplies a bearer token, and is asked for one on every request.
 *
 * This is the shape the generated client's `accessToken` hook already has, so a
 * provider can refresh transparently and callers never hold a token that has
 * since expired. Handing the SDK a token string instead would make the caller
 * responsible for noticing expiry mid-session.
 */
export type TokenProvider = () => Promise<string>;

/** A token obtained elsewhere: a Barndoor API key, or one from your own flow. */
export function staticToken(token: string): TokenProvider {
  return async () => token;
}

export interface ClientCredentialsOptions {
  clientId: string;
  clientSecret: string;
  /** Defaults to the issuer the spec declares (`x-issuer` on the OAuth2 scheme). */
  issuer?: string;
  /** Space-delimited. Defaults to what every published operation requires. */
  scope?: string;
  /**
   * Replaces the fetch used to reach the authorization server.
   *
   * The same seam `createFetch` offers: it exists for a proxy, a custom agent
   * or instrumentation, and it is what lets the token lifecycle be tested
   * against a stub instead of a live IdP.
   */
  fetch?: oidc.CustomFetch;
}

/**
 * Refresh a little before the server says the token dies, so a token that is
 * valid when checked is still valid when it arrives.
 */
const EXPIRY_SKEW_SECONDS = 60;

/**
 * Discovery, with an optional replacement fetch carried onto the resulting
 * configuration so later grants use it too — otherwise only the metadata
 * request would be redirected and the token request would go elsewhere.
 */
async function discoverWith(
  issuer: string,
  clientId: string,
  clientSecret: string | undefined,
  customFetch: oidc.CustomFetch | undefined
): Promise<oidc.Configuration> {
  const config = await oidc.discovery(
    new URL(issuer),
    clientId,
    clientSecret,
    undefined,
    customFetch ? { [oidc.customFetch]: customFetch } : undefined
  );
  if (customFetch) {
    config[oidc.customFetch] = customFetch;
  }
  return config;
}

/**
 * How long a token is good for, from a response that may not say.
 *
 * `expires_in` is optional in OAuth 2.0. Treating an absent value as "already
 * expired" would request a token per API call, so it is treated as unknown and
 * the token is used until a 401 forces a new one. `!= null`, not truthiness:
 * `expires_in: 0` means already expired and is falsy.
 */
function expiryFrom(expiresIn: number | undefined): number {
  return expiresIn != null ? Date.now() + (expiresIn - EXPIRY_SKEW_SECONDS) * 1000 : Number.POSITIVE_INFINITY;
}

/**
 * Machine-to-machine credentials.
 *
 * Discovery and the token request are both deferred to the first call rather
 * than run at construction: building a client should not make network calls,
 * and a service that never issues a request should not need the IdP to be
 * reachable.
 */
export function clientCredentials(options: ClientCredentialsOptions): TokenProvider {
  const {
    clientId,
    clientSecret,
    issuer = OAUTH_ISSUER,
    scope = 'openid profile email',
    fetch: customFetch,
  } = options;

  let configuration: Promise<oidc.Configuration> | undefined;
  let cached: { token: string; expiresAt: number } | undefined;
  let inFlight: Promise<string> | undefined;

  const discover = (): Promise<oidc.Configuration> => {
    // Memoised, not re-discovered per token: the metadata is stable and
    // discovery is a second network round trip on every refresh otherwise.
    //
    // Cleared on REJECTION, because `??=` caches the promise itself: a single
    // transient failure — an IdP restarting mid-deploy is enough — would
    // otherwise be replayed to every later call forever, and only a process
    // restart would recover. Success is kept.
    configuration ??= discoverWith(issuer, clientId, clientSecret, customFetch).catch(error => {
      configuration = undefined;
      throw error;
    });
    return configuration;
  };

  const fetchToken = async (): Promise<string> => {
    const config = await discover();
    const response = await oidc.clientCredentialsGrant(config, { scope });
    // `expires_in` is optional in OAuth 2.0. Treating an absent value as
    // "already expired" would request a token per API call, so it is instead
    // treated as unknown and the token is used until a 401 forces a new one.
    cached = {
      token: response.access_token,
      expiresAt: expiryFrom(response.expires_in),
    };
    return cached.token;
  };

  return async function getToken(): Promise<string> {
    if (cached && Date.now() < cached.expiresAt) {
      return cached.token;
    }
    // Concurrent requests arriving on an expired token must produce ONE token
    // request, not one each — every generated operation calls this hook, so a
    // burst of parallel calls would otherwise stampede the IdP.
    inFlight ??= fetchToken().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  };
}

/**
 * Exchange a refresh token, keeping the newest one.
 *
 * Refresh tokens are frequently single-use: an authorization server may return
 * a new one with each exchange and invalidate the old. Holding on to the
 * original would work exactly once.
 */
export function refreshToken(
  initialRefreshToken: string,
  options: { clientId: string; clientSecret?: string; issuer?: string }
): TokenProvider {
  const { clientId, clientSecret, issuer = OAUTH_ISSUER } = options;

  let configuration: Promise<oidc.Configuration> | undefined;
  let current = initialRefreshToken;
  let cached: { token: string; expiresAt: number } | undefined;
  let inFlight: Promise<string> | undefined;

  const exchange = async (): Promise<string> => {
    // Cleared on rejection for the same reason as in clientCredentials above.
    configuration ??= oidc.discovery(new URL(issuer), clientId, clientSecret).catch(error => {
      configuration = undefined;
      throw error;
    });
    const response = await oidc.refreshTokenGrant(await configuration, current);
    if (response.refresh_token) {
      current = response.refresh_token;
    }
    cached = {
      token: response.access_token,
      expiresAt: expiryFrom(response.expires_in),
    };
    return cached.token;
  };

  return async function getToken(): Promise<string> {
    if (cached && Date.now() < cached.expiresAt) {
      return cached.token;
    }
    inFlight ??= exchange().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  };
}

export interface AuthorizationCodeOptions {
  clientId: string;
  /** Where the authorization server sends the user back. Must be registered on the client. */
  redirectUri: string;
  /** Confidential clients only. Omit for a public client, which relies on PKCE. */
  clientSecret?: string;
  issuer?: string;
  scope?: string;
}

/** What {@link startAuthorizationCode} hands back, to be kept until the user returns. */
export interface AuthorizationCodeRequest {
  /** Send the user here. */
  authorizationUrl: string;
  /** Both must survive until the exchange, and neither may be reused. */
  codeVerifier: string;
  state: string;
}

/**
 * Begin an authorization code flow with PKCE.
 *
 * There is no callback listener here on purpose. Catching the redirect is one
 * way to obtain the code and it only works where a local port can be bound —
 * not over SSH, not in a container, not in a browser. A browser app already has
 * the redirect as its own page URL, and a script can ask the user to paste the
 * URL they landed on. Both then call {@link completeAuthorizationCode}.
 */
export async function startAuthorizationCode(
  options: AuthorizationCodeOptions
): Promise<AuthorizationCodeRequest> {
  const { clientId, clientSecret, redirectUri, issuer = OAUTH_ISSUER, scope = 'openid profile email' } = options;

  const config = await oidc.discovery(new URL(issuer), clientId, clientSecret);
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
  const state = oidc.randomState();

  const url = oidc.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri,
    scope,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });

  return { authorizationUrl: url.href, codeVerifier, state };
}

/**
 * Finish the flow and get a provider.
 *
 * `callbackUrl` is the full URL the user arrived at, query string included —
 * `window.location.href` in a browser, or whatever the user pasted.
 *
 * Returns a {@link TokenProvider} rather than a bare token so the session
 * refreshes itself: the access token is short-lived, and a caller handed a
 * string would have to notice expiry and re-run the whole interactive flow.
 */
export async function completeAuthorizationCode(
  options: AuthorizationCodeOptions & {
    callbackUrl: string;
    codeVerifier: string;
    state: string;
  }
): Promise<{ accessToken: string; refreshToken?: string; getToken: TokenProvider }> {
  const { clientId, clientSecret, issuer = OAUTH_ISSUER, callbackUrl, codeVerifier, state } = options;

  const config = await oidc.discovery(new URL(issuer), clientId, clientSecret);
  const tokens = await oidc.authorizationCodeGrant(config, new URL(callbackUrl), {
    pkceCodeVerifier: codeVerifier,
    // Checked, not skipped: without it a forged callback URL can inject an
    // attacker's code and bind the session to their account.
    expectedState: state,
  });

  // Without a refresh token there is nothing to renew with, so the access token
  // is served until it expires and the caller must start the flow again.
  const getToken = tokens.refresh_token
    ? refreshToken(tokens.refresh_token, { clientId, clientSecret, issuer })
    : staticToken(tokens.access_token);

  return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, getToken };
}
