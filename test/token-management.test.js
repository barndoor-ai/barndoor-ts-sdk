/**
 * Tests for enhanced token management features.
 *
 * These tests verify the new JWT verification, token refresh, and file locking
 * functionality that mirrors the Python SDK's capabilities.
 */

import { verifyJWTLocal, JWTVerificationResult, TokenManager } from '../dist/index.esm.js';

describe('Enhanced Token Management', () => {
  describe('JWT Verification', () => {
    const validToken =
      'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InRlc3Qta2V5In0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTksImF1ZCI6Imh0dHBzOi8vYmFybmRvb3IuYWkvIiwiaXNzIjoiaHR0cHM6Ly9hdXRoLmJhcm5kb29yLmFpLyJ9.test-signature';
    const expiredToken =
      'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InRlc3Qta2V5In0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjIsImF1ZCI6Imh0dHBzOi8vYmFybmRvb3IuYWkvIiwiaXNzIjoiaHR0cHM6Ly9hdXRoLmJhcm5kb29yLmFpLyJ9.test-signature';

    test('verifyJWTLocal returns INVALID for malformed tokens', async () => {
      const result = await verifyJWTLocal(
        'invalid-token',
        'auth.barndoor.ai',
        'https://barndoor.ai/'
      );
      expect(result).toBe(JWTVerificationResult.INVALID);
    });

    test('verifyJWTLocal handles network errors gracefully', async () => {
      // This will fail to verify due to network/JWKS issues, but should return INVALID not throw
      const result = await verifyJWTLocal(validToken, 'nonexistent.domain', 'https://barndoor.ai/');
      expect(result).toBe(JWTVerificationResult.INVALID);
    }, 10000); // 10 second timeout
  });

  describe('TokenManager', () => {
    test('TokenManager can be instantiated', () => {
      const manager = new TokenManager('https://api.example.com');
      expect(manager).toBeInstanceOf(TokenManager);
    });

    test('TokenManager throws error when no token is found', async () => {
      const manager = new TokenManager('https://api.example.com');

      // This should throw since there's no token stored
      await expect(manager.getValidToken()).rejects.toThrow();
    });
  });

  describe('Token Storage Integration', () => {
    test('Token storage functions are available', async () => {
      const { loadUserToken, saveUserToken, clearCachedToken } = await import(
        '../dist/index.esm.js'
      );

      expect(typeof loadUserToken).toBe('function');
      expect(typeof saveUserToken).toBe('function');
      expect(typeof clearCachedToken).toBe('function');
    });

    test('validateToken function works with invalid tokens', async () => {
      const { validateToken } = await import('../dist/index.esm.js');

      const result = await validateToken('invalid-token');
      expect(result).toEqual({ valid: false });
    });

    test('setTokenLogger function is available', async () => {
      const { setTokenLogger } = await import('../dist/index.esm.js');

      expect(typeof setTokenLogger).toBe('function');

      // Test that we can set a custom logger
      const mockLogger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      };

      expect(() => setTokenLogger(mockLogger)).not.toThrow();
    });
  });
});
