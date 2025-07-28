/**
 * Authentication module exports.
 * 
 * This module provides a unified interface for authentication functionality,
 * including PKCE OAuth flows, token storage, and interactive login.
 */

export {
  buildAuthorizationUrl,
  exchangeCodeForToken,
  startLocalCallbackServer,
  validateState,
  clearPKCEState
} from './pkce';

export {
  getTokenStorage,
  TokenManager,
  loadUserToken,
  saveUserToken,
  clearCachedToken
} from './store';

// Re-export types
export type { AuthorizationUrlParams, TokenExchangeParams, PKCEState } from './pkce';
export type { TokenData } from './store';
