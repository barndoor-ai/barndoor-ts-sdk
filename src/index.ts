/**
 * Barndoor SDK - JavaScript client for the Barndoor Platform API.
 *
 * The Barndoor SDK provides a simple, async interface for interacting with
 * the Barndoor platform, including:
 *
 * - User authentication and token management
 * - MCP server discovery and connection
 * - OAuth flow handling for third-party integrations
 * - Agent credential exchange
 *
 * Quick Start
 * -----------
 * ```javascript
 * import { BarndoorSDK } from '@barndoor-ai/sdk';
 *
 * const sdk = new BarndoorSDK('https://api.barndoor.host', {
 *   token: 'your_token'
 * });
 * const servers = await sdk.listServers();
 * ```
 *
 * For interactive login:
 * ```javascript
 * import { loginInteractive } from '@barndoor-ai/sdk';
 *
 * const sdk = await loginInteractive();
 * ```
 */

// Main SDK class
export { BarndoorSDK } from './client';
export type { FromClientCredentialsOptions } from './client';

// Exception classes
export {
  BarndoorError,
  AuthenticationError,
  TokenError,
  TokenExpiredError,
  TokenValidationError,
  ConnectionError,
  HTTPError,
  ServerNotFoundError,
  OAuthError,
  ConfigurationError,
  TimeoutError,
} from './exceptions';

// Data models
export { ServerSummary, ServerDetail, AgentToken } from './models';
// Notification channels (BCP-3758) — type-only, so they erase at runtime.
export type {
  AlertTypeOption,
  Channel,
  ChannelListResponse,
  ChannelOptions,
  ChannelSubscription,
  ChannelTestResult,
  ChannelType,
  LabeledOption,
  UpsertChannelInput,
  WebhookSecret,
} from './models';

// Quick-start helpers
export {
  loginInteractive,
  ensureServerConnected,
  makeMcpConnectionParams,
  makeMcpClient,
} from './quickstart';

// Authentication utilities
export {
  PKCEManager,
  startLocalCallbackServer,
  loadUserToken,
  saveUserToken,
  clearCachedToken,
  setTokenLogger,
  verifyJWTLocal,
  JWTVerificationResult,
  isTokenActive,
  isTokenActiveWithRefresh,
  validateToken,
  TokenManager,
  getOidcConfig,
  clearOidcConfigCache,
  getClientCredentialsToken,
} from './auth';
export type { OidcConfig, ClientCredentialsParams } from './auth';

// Configuration
export {
  AUTH_CONFIG,
  BarndoorConfig,
  getStaticConfig,
  getDynamicConfig,
  checkTokenOrganization,
  hasOrganizationInfo,
  isBrowser,
  isNode,
} from './config';

// Logging
export { setLogger, getLogger, createScopedLogger, debug, info, warn, error } from './logging';
export type { Logger } from './logging';

// Version
export { version } from './version';
