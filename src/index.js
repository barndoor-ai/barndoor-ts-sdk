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
 * import { BarndoorSDK } from '@barndoor/sdk';
 * 
 * const sdk = new BarndoorSDK('https://api.barndoor.host', { 
 *   token: 'your_token' 
 * });
 * const servers = await sdk.listServers();
 * ```
 * 
 * For interactive login:
 * ```javascript
 * import { loginInteractive } from '@barndoor/sdk';
 * 
 * const sdk = await loginInteractive();
 * ```
 */

// Main SDK class
export { BarndoorSDK } from './client.js';

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
  TimeoutError
} from './exceptions/index.js';

// Data models
export {
  ServerSummary,
  ServerDetail,
  AgentToken
} from './models/index.js';

// Quick-start helpers
export {
  loginInteractive,
  ensureServerConnected,
  makeMcpConnectionParams,
  makeMcpClient
} from './quickstart.js';

// Authentication utilities
export {
  buildAuthorizationUrl,
  exchangeCodeForToken,
  startLocalCallbackServer,
  validateState,
  clearPKCEState,
  loadUserToken,
  saveUserToken,
  clearCachedToken
} from './auth/index.js';

// Configuration
export {
  BarndoorConfig,
  getStaticConfig,
  getDynamicConfig,
  isBrowser,
  isNode
} from './config.js';

// Version
export const version = '0.1.0';
