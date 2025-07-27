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
} from './pkce.js';

export {
  getTokenStorage,
  TokenManager,
  loadUserToken,
  saveUserToken,
  clearCachedToken
} from './store.js';
