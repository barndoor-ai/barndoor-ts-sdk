/**
 * HTTP client with retry logic and error handling.
 * 
 * This module provides a robust HTTP client that mirrors the Python SDK's
 * HTTP client functionality, including automatic retries, timeout handling,
 * and proper error conversion.
 */

import fetch from 'cross-fetch';
import { HTTPError, ConnectionError, TimeoutError } from '../exceptions/index.js';

/**
 * Timeout configuration for HTTP requests.
 */
export class TimeoutConfig {
  /**
   * @param {number} [read=30] - Read timeout in seconds
   * @param {number} [connect=10] - Connect timeout in seconds
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
  /**
   * @param {TimeoutConfig} [timeoutConfig] - Timeout configuration
   * @param {number} [maxRetries=3] - Maximum number of retries
   */
  constructor(timeoutConfig = new TimeoutConfig(), maxRetries = 3) {
    this.timeoutConfig = timeoutConfig;
    this.maxRetries = maxRetries;
    this.closed = false;
  }
  
  /**
   * Make an HTTP request with retry logic.
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {Object} [options={}] - Request options
   * @returns {Promise<Object>} Response data
   */
  async request(method, url, options = {}) {
    if (this.closed) {
      throw new Error('HTTP client has been closed');
    }
    
    const { headers = {}, json, params, ...fetchOptions } = options;
    
    // Build URL with query parameters
    const requestUrl = this._buildUrl(url, params);
    
    // Prepare request options
    const requestOptions = {
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
    
    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutConfig.read);
    requestOptions.signal = controller.signal;
    
    let lastError;
    
    // Retry loop
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(requestUrl, requestOptions);
        clearTimeout(timeoutId);
        
        // Handle HTTP errors
        if (!response.ok) {
          const responseText = await response.text();
          throw new HTTPError(response.status, response.statusText, responseText);
        }
        
        // Parse JSON response
        const responseData = await response.json();
        return responseData;
        
      } catch (error) {
        clearTimeout(timeoutId);
        
        // Handle different types of errors
        if (error.name === 'AbortError') {
          lastError = new TimeoutError(`Request to ${requestUrl} timed out after ${this.timeoutConfig.read}ms`);
        } else if (error instanceof HTTPError) {
          // Don't retry HTTP errors (4xx, 5xx)
          throw error;
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
          lastError = new ConnectionError(requestUrl, error);
        } else {
          lastError = error;
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
    
    throw lastError;
  }
  
  /**
   * Build URL with query parameters.
   * @private
   */
  _buildUrl(baseUrl, params) {
    if (!params || Object.keys(params).length === 0) {
      return baseUrl;
    }
    
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, value);
      }
    });
    
    return url.toString();
  }
  
  /**
   * Sleep for the specified number of milliseconds.
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Close the HTTP client and clean up resources.
   */
  async close() {
    this.closed = true;
  }
  
  /**
   * Alias for close() to match Python SDK naming.
   */
  async aclose() {
    await this.close();
  }
}
