/**
 * HTTP client with retry logic and error handling.
 *
 * This module provides a robust HTTP client that mirrors the Python SDK's
 * HTTP client functionality, including automatic retries, timeout handling,
 * and proper error conversion.
 */

import fetch from 'cross-fetch';
import { HTTPError, ConnectionError, TimeoutError } from '../exceptions';

/**
 * HTTP request options interface.
 */
export interface HTTPRequestOptions {
  /** Request headers */
  headers?: Record<string, string>;
  /** JSON body to send */
  json?: unknown;
  /** Query parameters */
  params?: Record<string, string | number | boolean>;
  /** Additional fetch options */
  [key: string]: unknown;
}

/**
 * Timeout configuration for HTTP requests.
 */
export class TimeoutConfig {
  /** Read timeout in milliseconds */
  public readonly read: number;
  /** Connect timeout in milliseconds */
  public readonly connect: number;

  /**
   * Create a new TimeoutConfig.
   * @param read - Read timeout in seconds
   * @param connect - Connect timeout in seconds
   */
  constructor(read = 30, connect = 10) {
    this.read = read * 1000; // Convert to milliseconds
    this.connect = connect * 1000; // Convert to milliseconds
  }
}

/**
 * HTTP client with automatic retries and error handling.
 *
 * Provides a consistent interface for making HTTP requests with proper
 * error handling, timeout management, and retry logic.
 */
export class HTTPClient {
  /** Timeout configuration */
  private readonly timeoutConfig: TimeoutConfig;
  /** Maximum number of retries */
  private readonly maxRetries: number;
  /** Whether the client has been closed */
  public closed: boolean;

  /**
   * Create a new HTTPClient.
   * @param timeoutConfig - Timeout configuration
   * @param maxRetries - Maximum number of retries
   */
  constructor(timeoutConfig = new TimeoutConfig(), maxRetries = 3) {
    this.timeoutConfig = timeoutConfig;
    this.maxRetries = maxRetries;
    this.closed = false;
  }

  /**
   * Make an HTTP request with retry logic.
   * @param method - HTTP method
   * @param url - Request URL
   * @param options - Request options
   * @returns Response data
   */
  public async request(method: string, url: string, options: HTTPRequestOptions = {}): Promise<unknown> {
    if (this.closed) {
      throw new Error('HTTP client has been closed');
    }

    const { headers = {}, json, params, ...fetchOptions } = options;

    // Build URL with query parameters
    const requestUrl = this._buildUrl(url, params);

    // Prepare request options
    const requestOptions: RequestInit = {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'barndoor-js-sdk/0.1.0',
        ...headers
      },
      ...fetchOptions
    };

    // Add request body if provided
    if (json) {
      requestOptions.body = JSON.stringify(json);
    }

    let lastError: Error | undefined;

    // Retry loop
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      // Create fresh AbortController and timeout for each attempt
      const controller = new AbortController();

      // Set up overall request timeout (covers both connection and read)
      const totalTimeout = this.timeoutConfig.connect + this.timeoutConfig.read;
      const timeoutId = setTimeout(() => controller.abort(), totalTimeout);

      // Update signal for this attempt
      const attemptOptions = { ...requestOptions, signal: controller.signal };

      try {
        const response = await fetch(requestUrl, attemptOptions);
        clearTimeout(timeoutId);

        // Handle HTTP errors
        if (!response.ok) {
          const responseText = await response.text();
          throw new HTTPError(response.status, response.statusText, responseText);
        }

        // Parse response based on Content-Type
        const contentType = response.headers.get('content-type') || '';
        let responseData: unknown;

        if (contentType.includes('application/json')) {
          responseData = await response.json();
        } else if (contentType.includes('text/')) {
          responseData = await response.text();
        } else {
          // For binary data or unknown types, return as ArrayBuffer
          responseData = await response.arrayBuffer();
        }

        return responseData;
        
      } catch (error: unknown) {
        clearTimeout(timeoutId);

        // Handle different types of errors
        if (error instanceof Error && error.name === 'AbortError') {
          const totalTimeout = this.timeoutConfig.connect + this.timeoutConfig.read;
          lastError = new TimeoutError(`Request to ${requestUrl} timed out after ${totalTimeout}ms`);
        } else if (error instanceof HTTPError) {
          // Distinguish retryable 5xx from non-retryable 4xx errors
          if (error.statusCode >= 400 && error.statusCode < 500) {
            // 4xx errors are client errors - don't retry
            throw error;
          } else if (error.statusCode >= 500 && error.statusCode < 600) {
            // 5xx errors are server errors - retry these
            lastError = error;
          } else {
            // Other HTTP errors - don't retry
            throw error;
          }
        } else if (error instanceof Error && error.name === 'TypeError' && error.message.includes('fetch')) {
          lastError = new ConnectionError(requestUrl, error);
        } else {
          lastError = error instanceof Error ? error : new Error(String(error));
        }

        // Don't retry on the last attempt
        if (attempt === this.maxRetries) {
          break;
        }

        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await this._sleep(delay);
      }
    }

    // Ensure we always have an error to throw
    if (!lastError) {
      lastError = new Error(`Request to ${requestUrl} failed after ${this.maxRetries + 1} attempts with no specific error`);
    }
    throw lastError;
  }
  
  /**
   * Build URL with query parameters.
   * @private
   */
  private _buildUrl(baseUrl: string, params?: Record<string, string | number | boolean>): string {
    if (!params || Object.keys(params).length === 0) {
      return baseUrl;
    }

    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });

    return url.toString();
  }

  /**
   * Sleep for the specified number of milliseconds.
   * @private
   */
  private _sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close the HTTP client and clean up resources.
   */
  public async close(): Promise<void> {
    this.closed = true;
  }

  /**
   * Alias for close() to match Python SDK naming.
   */
  public async aclose(): Promise<void> {
    await this.close();
  }
}
