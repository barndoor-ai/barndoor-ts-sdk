/**
 * Exception classes for the Barndoor SDK.
 *
 * This module provides a complete hierarchy of error classes that mirror
 * the Python SDK exceptions exactly, ensuring API compatibility.
 */

/**
 * Base exception for all Barndoor SDK errors.
 */
export class BarndoorError extends Error {
  /**
   * Create a new BarndoorError.
   * @param message - Error message
   */
  constructor(message: string) {
    super(message);
    // Avoid relying on constructor.name (can be minified in builds)
    this.name = 'BarndoorError';
  }
}

/**
 * Raised when authentication fails.
 */
export class AuthenticationError extends BarndoorError {
  /** Optional error code for specific authentication failures */
  public readonly errorCode: string | null;

  /**
   * Create a new AuthenticationError.
   * @param message - Error message
   * @param errorCode - Optional error code
   */
  constructor(message: string, errorCode: string | null = null) {
    super(message);
    this.name = 'AuthenticationError';
    this.errorCode = errorCode;
  }
}

/**
 * Raised when token operations fail.
 */
export class TokenError extends AuthenticationError {
  /** Optional help text for resolving the error */
  public readonly helpText: string | null;

  /**
   * Create a new TokenError.
   * @param message - Error message
   * @param helpText - Optional help text
   */
  constructor(message: string, helpText: string | null = null) {
    let fullMessage = message;
    if (helpText) {
      fullMessage += ` ${helpText}`;
    } else {
      fullMessage += " Run 'barndoor-login' to authenticate.";
    }

    super(fullMessage);
    this.name = 'TokenError';
    this.helpText = helpText;
  }
}

/**
 * Raised when a token has expired.
 */
export class TokenExpiredError extends TokenError {}

/**
 * Raised when token validation fails.
 */
export class TokenValidationError extends TokenError {}

/**
 * Raised when unable to connect to the Barndoor API.
 */
export class ConnectionError extends BarndoorError {
  /** The URL that failed to connect */
  public readonly url: string;
  /** The original error that caused the connection failure */
  public readonly originalError: Error;

  /**
   * Create a new ConnectionError.
   * @param url - The URL that failed to connect
   * @param originalError - The original error that caused the failure
   */
  constructor(url: string, originalError: Error) {
    let userMessage: string;
    const errorStr = originalError.toString().toLowerCase();

    if (errorStr.includes('timeout')) {
      userMessage = `Connection to ${url} timed out. Please check your internet connection and try again.`;
    } else if (errorStr.includes('connection refused')) {
      userMessage = `Could not connect to ${url}. The service may be unavailable.`;
    } else if (errorStr.includes('name resolution') || errorStr.includes('getaddrinfo')) {
      userMessage = `Could not resolve hostname for ${url}. Please check the URL and your DNS settings.`;
    } else {
      userMessage = `Failed to connect to ${url}. Please check your internet connection.`;
    }

    super(userMessage);
    this.url = url;
    this.originalError = originalError;
  }
}

/**
 * Raised for HTTP error responses.
 */
export class HTTPError extends BarndoorError {
  /** HTTP status code */
  public readonly statusCode: number;
  /** Raw response body */
  public readonly responseBody: string | null;

  /**
   * Create a new HTTPError.
   * @param statusCode - HTTP status code
   * @param message - Error message
   * @param responseBody - Raw response body
   */
  constructor(statusCode: number, message: string, responseBody: string | null = null) {
    const userMessage = HTTPError._createUserFriendlyMessage(statusCode, message, responseBody);
    super(userMessage);
    this.name = 'HTTPError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }

  /**
   * Create a user-friendly error message based on HTTP status code.
   * @private
   */
  private static _createUserFriendlyMessage(
    statusCode: number,
    message: string,
    _responseBody: string | null
  ): string {
    const baseMessage = `Request failed (HTTP ${statusCode})`;

    if (statusCode === 400) {
      return `${baseMessage}: Invalid request. Please check your input parameters.`;
    } else if (statusCode === 401) {
      return `${baseMessage}: Authentication failed. Please check your token or re-authenticate.`;
    } else if (statusCode === 403) {
      return `${baseMessage}: Access denied. You don't have permission for this operation.`;
    } else if (statusCode === 404) {
      return `${baseMessage}: Resource not found. Please check the server ID or URL.`;
    } else if (statusCode === 429) {
      return `${baseMessage}: Rate limit exceeded. Please wait before making more requests.`;
    } else if (statusCode >= 500 && statusCode < 600) {
      return `${baseMessage}: Server error. Please try again later or contact support.`;
    } else {
      return `${baseMessage}: ${message}`;
    }
  }
}

/**
 * Raised when a requested server is not found.
 */
export class ServerNotFoundError extends BarndoorError {
  /** The server identifier that was not found */
  public readonly serverIdentifier: string;
  /** List of available servers, if provided */
  public readonly availableServers: string[] | null;

  /**
   * Create a new ServerNotFoundError.
   * @param serverIdentifier - The server identifier that was not found
   * @param availableServers - Optional list of available servers
   */
  constructor(serverIdentifier: string, availableServers: string[] | null = null) {
    let message = `Server '${serverIdentifier}' not found`;
    if (availableServers) {
      message += `. Available servers: ${availableServers.join(', ')}`;
    } else {
      message += '. Use listServers() to see available servers.';
    }

    super(message);
    this.serverIdentifier = serverIdentifier;
    this.availableServers = availableServers;
  }
}

/**
 * Raised when OAuth authentication fails.
 */
export class OAuthError extends AuthenticationError {}

/**
 * Raised when there's an issue with SDK configuration.
 */
export class ConfigurationError extends BarndoorError {}

/**
 * Raised when an operation times out.
 */
export class TimeoutError extends BarndoorError {}
