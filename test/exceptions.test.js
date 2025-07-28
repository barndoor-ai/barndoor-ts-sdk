/**
 * Tests for exception hierarchy and error handling.
 */

import {
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
} from '../dist/index.esm.js';

describe('Exception Hierarchy', () => {
  test('exception inheritance is correct', () => {
    expect(AuthenticationError.prototype).toBeInstanceOf(BarndoorError);
    expect(TokenError.prototype).toBeInstanceOf(AuthenticationError);
    expect(TokenExpiredError.prototype).toBeInstanceOf(TokenError);
    expect(TokenValidationError.prototype).toBeInstanceOf(TokenError);
    expect(ConnectionError.prototype).toBeInstanceOf(BarndoorError);
    expect(HTTPError.prototype).toBeInstanceOf(BarndoorError);
    expect(ServerNotFoundError.prototype).toBeInstanceOf(BarndoorError);
    expect(OAuthError.prototype).toBeInstanceOf(AuthenticationError);
    expect(ConfigurationError.prototype).toBeInstanceOf(BarndoorError);
    expect(TimeoutError.prototype).toBeInstanceOf(BarndoorError);
  });

  test('BarndoorError is base exception', () => {
    const error = new BarndoorError('test message');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('BarndoorError');
    expect(error.message).toBe('test message');
  });

  test('AuthenticationError stores error code', () => {
    const error = new AuthenticationError('auth failed', 'AUTH001');
    expect(error).toBeInstanceOf(BarndoorError);
    expect(error.errorCode).toBe('AUTH001');
    expect(error.message).toBe('auth failed');
  });

  test('TokenError adds help text', () => {
    const errorWithHelp = new TokenError('token invalid', 'Custom help text');
    expect(errorWithHelp.message).toBe('token invalid Custom help text');
    expect(errorWithHelp.helpText).toBe('Custom help text');

    const errorWithoutHelp = new TokenError('token invalid');
    expect(errorWithoutHelp.message).toBe('token invalid Run \'barndoor-login\' to authenticate.');
    expect(errorWithoutHelp.helpText).toBeNull();
  });

  test('ConnectionError creates user-friendly messages', () => {
    const timeoutError = new ConnectionError('https://api.example.com', new Error('timeout'));
    expect(timeoutError.message).toContain('timed out');
    expect(timeoutError.url).toBe('https://api.example.com');

    const refusedError = new ConnectionError('https://api.example.com', new Error('connection refused'));
    expect(refusedError.message).toContain('Could not connect');

    const dnsError = new ConnectionError('https://api.example.com', new Error('name resolution failed'));
    expect(dnsError.message).toContain('Could not resolve hostname');

    const genericError = new ConnectionError('https://api.example.com', new Error('generic error'));
    expect(genericError.message).toContain('Failed to connect');
  });

  test('HTTPError creates status-specific messages', () => {
    const badRequest = new HTTPError(400, 'Bad Request');
    expect(badRequest.message).toContain('Invalid request');
    expect(badRequest.statusCode).toBe(400);

    const unauthorized = new HTTPError(401, 'Unauthorized');
    expect(unauthorized.message).toContain('Authentication failed');

    const forbidden = new HTTPError(403, 'Forbidden');
    expect(forbidden.message).toContain('Access denied');

    const notFound = new HTTPError(404, 'Not Found');
    expect(notFound.message).toContain('Resource not found');

    const rateLimit = new HTTPError(429, 'Too Many Requests');
    expect(rateLimit.message).toContain('Rate limit exceeded');

    const serverError = new HTTPError(500, 'Internal Server Error');
    expect(serverError.message).toContain('Server error');

    const unknownError = new HTTPError(418, 'I\'m a teapot');
    expect(unknownError.message).toContain('I\'m a teapot');
  });

  test('ServerNotFoundError with available servers', () => {
    const availableServers = ['server1', 'server2', 'server3'];
    const error = new ServerNotFoundError('missing-server', availableServers);
    
    expect(error.message).toContain('missing-server');
    expect(error.message).toContain('server1, server2, server3');
    expect(error.serverIdentifier).toBe('missing-server');
    expect(error.availableServers).toEqual(availableServers);
  });

  test('ServerNotFoundError without available servers', () => {
    const error = new ServerNotFoundError('missing-server');
    
    expect(error.message).toContain('missing-server');
    expect(error.message).toContain('Use listServers()');
    expect(error.availableServers).toBeNull();
  });
});

describe('Error Instantiation', () => {
  test('all error types can be instantiated', () => {
    expect(() => new BarndoorError('test')).not.toThrow();
    expect(() => new AuthenticationError('test')).not.toThrow();
    expect(() => new TokenError('test')).not.toThrow();
    expect(() => new TokenExpiredError('test')).not.toThrow();
    expect(() => new TokenValidationError('test')).not.toThrow();
    expect(() => new ConnectionError('url', new Error('test'))).not.toThrow();
    expect(() => new HTTPError(500, 'test')).not.toThrow();
    expect(() => new ServerNotFoundError('test')).not.toThrow();
    expect(() => new OAuthError('test')).not.toThrow();
    expect(() => new ConfigurationError('test')).not.toThrow();
    expect(() => new TimeoutError('test')).not.toThrow();
  });

  test('error names are set correctly', () => {
    expect(new BarndoorError('test').name).toBe('BarndoorError');
    expect(new AuthenticationError('test').name).toBe('AuthenticationError');
    expect(new TokenError('test').name).toBe('TokenError');
    expect(new HTTPError(500, 'test').name).toBe('HTTPError');
  });
});
