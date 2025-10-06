/**
 * Tests for enhanced token management features.
 *
 * These tests verify the new JWT verification, token refresh, and file locking
 * functionality that mirrors the Python SDK's capabilities.
 */

import { 
  verifyJWTLocal, 
  JWTVerificationResult, 
  TokenManager, 
  setTokenLogger,
  loadUserToken,
  saveUserToken,
  clearCachedToken,
  validateToken
} from '../dist/index.esm.js';

// Mock crypto for Node.js compatibility in test environment
import crypto from 'crypto';
if (!global.crypto) {
  global.crypto = crypto.webcrypto;
}

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
    // Clear any cached tokens before tests
    beforeEach(async () => {
      try {
        await clearCachedToken();
      } catch (e) {
        // Ignore errors from clearing non-existent tokens
      }
    });

    test('TokenManager can be instantiated', () => {
      const manager = new TokenManager('https://api.example.com');
      expect(manager).toBeInstanceOf(TokenManager);
    });

    test('TokenManager throws error when no token is found', async () => {
      const manager = new TokenManager('https://api.example.com');

      // This should throw since there's no token stored
      await expect(manager.getValidToken()).rejects.toThrow('No token found');
    });
  });

  describe('Token Storage Integration', () => {
    test('Token storage functions are available', () => {
      expect(typeof loadUserToken).toBe('function');
      expect(typeof saveUserToken).toBe('function');
      expect(typeof clearCachedToken).toBe('function');
    });

    test('validateToken function works with invalid tokens', async () => {
      // Use a properly formatted JWT with invalid signature
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid-signature';
      const result = await validateToken(invalidToken);
      expect(result).toEqual({ valid: false });
    });

    test('setTokenLogger function is available and deprecated', () => {
      expect(typeof setTokenLogger).toBe('function');

      // Test that we can set a custom logger
      const mockLogger = {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      };

      // Mock console.warn to capture the deprecation message
      const originalWarn = console.warn;
      let warnCalled = false;
      let warnMessage = '';
      console.warn = (msg) => {
        warnCalled = true;
        warnMessage = msg;
      };

      setTokenLogger(mockLogger);

      // Verify deprecation warning was logged
      expect(warnCalled).toBe(true);
      expect(warnMessage).toBe(
        'setTokenLogger is deprecated. Use setLogger from the main logging module instead.'
      );

      // Restore console.warn
      console.warn = originalWarn;
    });
  });
});
