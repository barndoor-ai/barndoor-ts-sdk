/**
 * Tests for organization ID validation regex
 */

import { getDynamicConfig, ConfigurationError } from '../dist/index.esm.js';

describe('Organization ID validation regex', () => {
  test('accepts lowercase letters, numbers, hyphens, and underscores', () => {
    const validOrgIds = [
      'simple-org',
      'org123',
      'test_org',
      'org_with_underscores',
      'complex-org_123',
      'a',
      '123',
      'org-123-test',
      'org_gFEnMMMIhsK5yiW9', // Real Auth0 org ID format
      'fcdc562c-546c-4cca-8fee-e557a642dc9d', // UUID format
    ];

    validOrgIds.forEach(orgId => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        Buffer.from(JSON.stringify({
          organization_name: orgId,
          iat: 1600000000,
          exp: 1600003600,
        })).toString('base64').replace(/=/g, '') +
        '.signature';

      expect(() => getDynamicConfig(token)).not.toThrow();
      const config = getDynamicConfig(token);
      expect(config.apiBaseUrl).toContain(orgId.toLowerCase());
    });
  });

  test('rejects invalid characters in organization ID', () => {
    const invalidOrgIds = [
      'org with spaces',
      'org@special',
      'org#hash',
      'org/slash',
      'org\\backslash',
      'org.period',
      'org,comma',
      'org;semicolon',
      'org:colon',
      'org!exclamation',
      'org?question',
      'org&ampersand',
      'org*asterisk',
      'org(parenthesis)',
      'org[bracket]',
      'org{brace}',
      'org|pipe',
      'org+plus',
      'org=equals',
      'org%percent',
      'org$dollar',
      'org^caret',
      'org~tilde',
      'org`backtick',
      'org"quote',
      "org'apostrophe",
      'org<less>',
    ];

    invalidOrgIds.forEach(orgId => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        Buffer.from(JSON.stringify({
          organization_name: orgId,
          iat: 1600000000,
          exp: 1600003600,
        })).toString('base64').replace(/=/g, '') +
        '.signature';

      try {
        getDynamicConfig(token);
        // If it didn't throw, fail the test
        expect(true).toBe(false); // This org ID should have been invalid
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationError);
        expect(error.message).toContain('Invalid organization ID format from token');
      }
    });
  });

  test('handles mixed case by converting to lowercase', () => {
    const mixedCaseOrgIds = [
      { input: 'BarndoorAI', expected: 'barndoorai' },
      { input: 'Test_Org', expected: 'test_org' },
      { input: 'ORG_123', expected: 'org_123' },
      { input: 'MixedCase-Org', expected: 'mixedcase-org' },
    ];

    mixedCaseOrgIds.forEach(({ input, expected }) => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        Buffer.from(JSON.stringify({
          organization_name: input,
          iat: 1600000000,
          exp: 1600003600,
        })).toString('base64').replace(/=/g, '') +
        '.signature';

      const config = getDynamicConfig(token);
      expect(config.apiBaseUrl).toContain(expected);
      expect(config.mcpBaseUrl).toContain(expected);
    });
  });

  test('trims whitespace from organization ID', () => {
    const paddedOrgIds = [
      { input: '  test-org  ', expected: 'test-org' },
      { input: '\torg_123\t', expected: 'org_123' },
      { input: '\nbarndoor-ai\n', expected: 'barndoor-ai' },
      { input: ' org_with_spaces ', expected: 'org_with_spaces' },
    ];

    paddedOrgIds.forEach(({ input, expected }) => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        Buffer.from(JSON.stringify({
          organization_name: input,
          iat: 1600000000,
          exp: 1600003600,
        })).toString('base64').replace(/=/g, '') +
        '.signature';

      const config = getDynamicConfig(token);
      expect(config.apiBaseUrl).toContain(expected);
    });
  });

  test('regex matches exactly what we expect', () => {
    // Direct regex test to ensure it's correct
    const regex = /^[a-z0-9_-]+$/;
    
    // Valid patterns
    expect(regex.test('simple')).toBe(true);
    expect(regex.test('with-hyphen')).toBe(true);
    expect(regex.test('with_underscore')).toBe(true);
    expect(regex.test('with123numbers')).toBe(true);
    expect(regex.test('mix-all_123')).toBe(true);
    expect(regex.test('a')).toBe(true);
    expect(regex.test('1')).toBe(true);
    expect(regex.test('-')).toBe(true);
    expect(regex.test('_')).toBe(true);
    
    // Invalid patterns
    expect(regex.test('with space')).toBe(false);
    expect(regex.test('WITH_UPPERCASE')).toBe(false);
    expect(regex.test('special@char')).toBe(false);
    expect(regex.test('dot.com')).toBe(false);
    expect(regex.test('')).toBe(false);
    expect(regex.test('emoji😀')).toBe(false);
  });
});
