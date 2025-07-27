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
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Raised when authentication fails.
 */
export class AuthenticationError extends BarndoorError {
  constructor(message, errorCode = null) {
    super(message);
    this.errorCode = errorCode;
  }
}

/**
 * Raised when token operations fail.
 */
export class TokenError extends AuthenticationError {
  constructor(message, helpText = null) {
    let fullMessage = message;
    if (helpText) {
      fullMessage += ` ${helpText}`;
    } else {
      fullMessage += " Run 'barndoor-login' to authenticate.";
    }
    
    super(fullMessage);
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
  constructor(url, originalError) {
    let userMessage;
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
  constructor(statusCode, message, responseBody = null) {
    const userMessage = HTTPError._createUserFriendlyMessage(statusCode, message, responseBody);
    super(userMessage);
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
  
  static _createUserFriendlyMessage(statusCode, message, responseBody) {
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
  constructor(serverIdentifier, availableServers = null) {
    let message = `Server '${serverIdentifier}' not found`;
    if (availableServers) {
      message += `. Available servers: ${availableServers.join(', ')}`;
    } else {
      message += ". Use listServers() to see available servers.";
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
