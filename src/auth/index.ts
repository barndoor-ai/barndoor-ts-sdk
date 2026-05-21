/**
 * Authentication module exports.
 *
 * This module provides a unified interface for authentication functionality,
 * including PKCE OAuth flows, token storage, and interactive login.
 */

export { PKCEManager, startLocalCallbackServer } from './pkce';

export { getClientCredentialsToken, _tokenNearExpiry } from './clientCredentials';
export type { ClientCredentialsParams } from './clientCredentials';

export {
  getTokenStorage,
  TokenManager,
  loadUserToken,
  saveUserToken,
  clearCachedToken,
  verifyJWTLocal,
  JWTVerificationResult,
  isTokenActive,
  isTokenActiveWithRefresh,
  validateToken,
  setTokenLogger,
  getOidcConfig,
  clearOidcConfigCache,
} from './store';

// Re-export OIDC types
export type { OidcConfig } from './store';

// Re-export types
export type { AuthorizationUrlParams, TokenExchangeParams, PKCEState } from './pkce';
export type { TokenData } from './store';
