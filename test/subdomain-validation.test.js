/**
 * Tests for organization subdomain validation
 * Ensures only valid DNS subdomain formats are accepted
 */

import { getDynamicConfig, ConfigurationError, checkTokenOrganization } from '../dist/index.esm.js';

describe('Organization subdomain validation', () => {
  test('accepts valid DNS subdomain formats', () => {
    const validSubdomains = [
      'simple-org',
      'org123',
      'a',
      '123',
      'org-123-test',
      'barndoor-ai',
      'test-company',
      'company-123',
      'my-organization',
      '3rdparty',
      'x',
    ];

    validSubdomains.forEach(subdomain => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        Buffer.from(JSON.stringify({
          organization_name: subdomain,
          iat: 1600000000,
          exp: 1600003600,
        })).toString('base64').replace(/=/g, '') +
        '.signature';

      expect(() => getDynamicConfig(token)).not.toThrow();
      const config = getDynamicConfig(token);
      expect(config.apiBaseUrl).toContain(subdomain.toLowerCase());
    });
  });

  test('rejects invalid DNS subdomain formats', () => {
    const invalidSubdomains = [
      'org_with_underscores',     // Underscores not valid in DNS
      'org_gFEnMMMIhsK5yiW9',     // Auth0 org IDs not valid for subdomains
      '-start-with-hyphen',        // Cannot start with hyphen
      'end-with-hyphen-',          // Cannot end with hyphen
      'org with spaces',           // Spaces not allowed
      'org.with.dots',             // Dots not allowed in our case
      'org@email',                 // Special characters not allowed
      'org#hash',
      'org$dollar',
      'org%percent',
      'org&and',
      'org*star',
      'org+plus',
      'org=equals',
      'org[bracket',
      'org]bracket',
      'org{brace',
      'org}brace',
      'org|pipe',
      'org\\backslash',
      'org/slash',
      'org:colon',
      'org;semicolon',
      'org"quote',
      "org'apostrophe",
      'org<less>',
    ];

    invalidSubdomains.forEach(subdomain => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        Buffer.from(JSON.stringify({
          organization_name: subdomain,
          iat: 1600000000,
          exp: 1600003600,
        })).toString('base64').replace(/=/g, '') +
        '.signature';

      try {
        getDynamicConfig(token);
        fail(`Expected '${subdomain}' to throw but it didn't`);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationError);
        // Check that the error message is appropriate for the type of invalid subdomain
        if (subdomain === '') {
          // Empty string should result in "No organization information found"
          expect(error.message).toContain('No organization information found in token');
        } else {
          // Other invalid formats should result in "Invalid organization subdomain format"
          expect(error.message).toContain('Invalid organization subdomain format from token');
        }
      }
    });
  });

  test('rejects empty organization names', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      Buffer.from(JSON.stringify({
        organization_name: '',
        iat: 1600000000,
        exp: 1600003600,
      })).toString('base64').replace(/=/g, '') +
      '.signature';

    const result = checkTokenOrganization(token);
    expect(result.hasOrganization).toBe(false);
    expect(result.error).toContain('No organization information found in token');
  });

  test('rejects hyphen-only organization names at config level', () => {
    const hyphenOnlyNames = ['-', '--', '---'];

    hyphenOnlyNames.forEach(orgName => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        Buffer.from(JSON.stringify({
          organization_name: orgName,
          iat: 1600000000,
          exp: 1600003600,
        })).toString('base64').replace(/=/g, '') +
        '.signature';

      // checkTokenOrganization will accept these (they're not empty)
      const result = checkTokenOrganization(token);
      expect(result.hasOrganization).toBe(true);
      expect(result.organizationId).toBe(orgName);

      // But getDynamicConfig should reject them as invalid subdomains
      try {
        getDynamicConfig(token);
        fail(`Expected '${orgName}' to throw but it didn't`);
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationError);
        expect(error.message).toContain('Invalid organization subdomain format from token');
      }
    });
  });

  test('does not use org_id fields for subdomain', () => {
    // Test that org_id fields are not used even if they're the only ones present
    const tokenWithOnlyOrgId = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      Buffer.from(JSON.stringify({
        org_id: 'org_gFEnMMMIhsK5yiW9',
        organization_id: 'org_someOtherId123',
        'https://barndoor.ai/organization_id': 'org_customClaimId',
        iat: 1600000000,
        exp: 1600003600,
      })).toString('base64').replace(/=/g, '') +
      '.signature';

    const result = checkTokenOrganization(tokenWithOnlyOrgId);
    expect(result.hasOrganization).toBe(false);
    expect(result.error).toContain('No organization information found in token');
  });

  test('prioritizes organization_name over other fields', () => {
    const tokenWithMultipleFields = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      Buffer.from(JSON.stringify({
        organization_name: 'barndoor-ai',
        organization_slug: 'different-slug',
        org_slug: 'another-slug',
        org_id: 'org_gFEnMMMIhsK5yiW9',
        iat: 1600000000,
        exp: 1600003600,
      })).toString('base64').replace(/=/g, '') +
      '.signature';

    const config = getDynamicConfig(tokenWithMultipleFields);
    expect(config.apiBaseUrl).toContain('barndoor-ai');
    expect(config.mcpBaseUrl).toContain('barndoor-ai');
  });

  test('subdomain regex matches DNS requirements', () => {
    // Direct regex test for DNS subdomain requirements
    const regex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
    
    // Valid patterns
    expect(regex.test('simple')).toBe(true);
    expect(regex.test('with-hyphen')).toBe(true);
    expect(regex.test('with123numbers')).toBe(true);
    expect(regex.test('a')).toBe(true);
    expect(regex.test('1')).toBe(true);
    expect(regex.test('123-test')).toBe(true);
    expect(regex.test('test-123')).toBe(true);
    
    // Invalid patterns
    expect(regex.test('with_underscore')).toBe(false);
    expect(regex.test('-startwithhyphen')).toBe(false);
    expect(regex.test('endwithhyphen-')).toBe(false);
    expect(regex.test('with space')).toBe(false);
    expect(regex.test('with.dot')).toBe(false);
    expect(regex.test('special@char')).toBe(false);
    expect(regex.test('')).toBe(false);
    expect(regex.test('-')).toBe(false);
    expect(regex.test('--')).toBe(false);
    expect(regex.test('a-')).toBe(false);
    expect(regex.test('-a')).toBe(false);
    expect(regex.test('emoji😀')).toBe(false);
  });
});
