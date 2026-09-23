/**
 * The hand-written half of the SDK.
 *
 * Everything else under `src/` is generated from `docs/api/public-openapi.yaml`
 * and is not committed — `make gen-sdk-typescript` recreates it. This directory
 * holds only what an OpenAPI document cannot describe: obtaining a token,
 * transport resilience, non-production hosts, and the MCP client.
 *
 * Re-exported from the package root by `templates/index.mustache`.
 */

export { createClient, type BarndoorClient, type ClientOptions } from './client.js';

export {
  clientCredentials,
  completeAuthorizationCode,
  refreshToken,
  startAuthorizationCode,
  staticToken,
  type AuthorizationCodeOptions,
  type AuthorizationCodeRequest,
  type ClientCredentialsOptions,
  type TokenProvider,
} from './auth.js';

export { DEV, LOCAL, environmentFromEnv, type Environment } from './config.js';
export { createFetch, type RetryOptions } from './http.js';
export { createMcpClient, mcpConnectionParams, type McpOptions } from './mcp.js';
