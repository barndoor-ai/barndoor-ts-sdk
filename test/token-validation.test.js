/**
 * Tests for token validation fixes from code review.
 *
 * These tests verify that the token validation race condition fix works correctly,
 * ensuring tokens are only validated in appropriate environments and that the
 * _tokenValidated flag is only set when tokens are actually valid.
 */

import { BarndoorSDK } from '../dist/index.esm.js';

describe('Token Validation Fixes', () => {
  describe('Environment-based validation behavior', () => {
    const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const originalEnv = process.env.BARNDOOR_ENV;
    const originalFetch = global.fetch;

    afterEach(() => {
      process.env.BARNDOOR_ENV = originalEnv;
      global.fetch = originalFetch;
    });

    test('skips validation in test environment', async () => {
      process.env.BARNDOOR_ENV = 'test';

      const sdk = new BarndoorSDK('https://api.example.com', { token: validToken });

      // Should not throw since we're in test environment
      await expect(sdk.ensureValidToken()).resolves.toBeUndefined();
      expect(sdk._tokenValidated).toBe(true);
    });

    test('skips validation in ci environment', async () => {
      process.env.BARNDOOR_ENV = 'ci';

      const sdk = new BarndoorSDK('https://api.example.com', { token: validToken });

      // Should not throw since we're in ci environment
      await expect(sdk.ensureValidToken()).resolves.toBeUndefined();
      expect(sdk._tokenValidated).toBe(true);
    });

    test('validates token in development environment', async () => {
      process.env.BARNDOOR_ENV = 'development';

      // Mock fetch to simulate token validation failure
      global.fetch = () => Promise.resolve({
        ok: false,
        status: 401
      });

      const sdk = new BarndoorSDK('https://api.example.com', { token: validToken });

      // Should throw since we're in development and token validation fails
      await expect(sdk.ensureValidToken()).rejects.toThrow('Token validation failed');
    });

    test('validates token in production environment', async () => {
      process.env.BARNDOOR_ENV = 'production';

      // Mock fetch to simulate token validation failure
      global.fetch = () => Promise.resolve({
        ok: false,
        status: 401
      });

      const sdk = new BarndoorSDK('https://api.example.com', { token: validToken });

      // Should throw since we're in production and token validation fails
      await expect(sdk.ensureValidToken()).rejects.toThrow('Token validation failed');
    });

    test('only sets _tokenValidated to true when token is actually valid', async () => {
      process.env.BARNDOOR_ENV = 'production';

      // Test 1: Valid token should set _tokenValidated to true
      global.fetch = () => Promise.resolve({
        ok: true,
        status: 200
      });

      const sdk = new BarndoorSDK('https://api.example.com', { token: validToken });

      const isValid = await sdk.validateCachedToken();
      expect(isValid).toBe(true);
      expect(sdk._tokenValidated).toBe(true);

      // Test 2: Invalid token should NOT set _tokenValidated to true
      sdk._tokenValidated = false;
      global.fetch = () => Promise.resolve({
        ok: false,
        status: 401
      });

      const isValidSecond = await sdk.validateCachedToken();
      expect(isValidSecond).toBe(false);
      expect(sdk._tokenValidated).toBe(false); // Critical: should remain false for invalid tokens
    });
  });
});
