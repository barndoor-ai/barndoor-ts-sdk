import {
  Configuration,
  type Middleware,
  DlpApi,
  IdentityApi,
  LlmGatewayApi,
  NotificationApi,
  PolicyApi,
  RegistryApi,
  SystemManagementApi,
} from '../index.js';

import { clientCredentials, staticToken, type ClientCredentialsOptions, type TokenProvider } from './auth.js';
import { type Environment } from './config.js';
import { createFetch, type RetryOptions } from './http.js';

export interface ClientOptions {
  /**
   * How to authenticate. One of:
   *
   * - a token string — a Barndoor API key, or one you obtained yourself
   * - machine-to-machine credentials, exchanged and refreshed for you
   * - your own {@link TokenProvider}, asked for a token on every request
   */
  auth: string | ClientCredentialsOptions | TokenProvider;
  /** Defaults to production, which the generated client already points at. */
  env?: Environment;
  /** Retry and timeout behaviour. `false` disables retrying. */
  retry?: RetryOptions | false;
  /**
   * Run around every request: `pre`, `post` and `onError`.
   *
   * This is the extension point for logging, tracing and metrics — the SDK
   * itself logs nothing, so a caller who wants visibility into requests adds it
   * here rather than configuring a logger we would have to define.
   */
  middleware?: Middleware[];
  /** Sent on every request. */
  headers?: Record<string, string>;
}

export interface BarndoorClient {
  registry: RegistryApi;
  policy: PolicyApi;
  identity: IdentityApi;
  notification: NotificationApi;
  dlp: DlpApi;
  llmGateway: LlmGatewayApi;
  systemManagement: SystemManagementApi;
  /** The underlying configuration, for constructing an API class this does not expose. */
  configuration: Configuration;
}

function resolveAuth(auth: ClientOptions['auth'], env?: Environment): TokenProvider {
  if (typeof auth === 'function') return auth;
  if (typeof auth === 'string') return staticToken(auth);
  // Credentials inherit the environment's issuer, so pointing at dev cannot
  // leave the API on dev while the token comes from production.
  return clientCredentials(env ? { issuer: env.issuer, ...auth } : auth);
}

/**
 * Assemble a client.
 *
 * Synchronous on purpose: nothing here touches the network. OIDC discovery and
 * the first token exchange are deferred to the first request, so constructing a
 * client cannot fail because an IdP is briefly unreachable.
 *
 * Retries are on unless switched off. Wiring `fetchApi` by hand is easy to
 * forget, and forgetting it fails invisibly — the client simply becomes less
 * resilient, with nothing to notice until a deploy produces a burst of 503s.
 */
export function createClient(options: ClientOptions): BarndoorClient {
  const { auth, env, retry, middleware, headers } = options;

  const configuration = new Configuration({
    // Omitted for production: the generated BASE_PATH already is production,
    // taken from the spec's `servers` block.
    ...(env?.baseUrl ? { basePath: env.baseUrl } : {}),
    accessToken: resolveAuth(auth, env),
    ...(retry === false ? {} : { fetchApi: createFetch(retry) }),
    ...(middleware ? { middleware } : {}),
    ...(headers ? { headers } : {}),
  });

  return {
    registry: new RegistryApi(configuration),
    policy: new PolicyApi(configuration),
    identity: new IdentityApi(configuration),
    notification: new NotificationApi(configuration),
    dlp: new DlpApi(configuration),
    llmGateway: new LlmGatewayApi(configuration),
    systemManagement: new SystemManagementApi(configuration),
    configuration,
  };
}
