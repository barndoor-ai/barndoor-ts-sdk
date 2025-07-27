/**
 * Tests for HTTP client.
 */

import { HTTPClient, TimeoutConfig } from '../src/http/client.js';
import { HTTPError, ConnectionError, TimeoutError } from '../src/exceptions/index.js';

// Mock fetch for testing
const mockFetch = {
  fn: () => {},
  mockResolvedValueOnce: (value) => {
    mockFetch.fn = () => Promise.resolve(value);
    return mockFetch;
  },
  mockRejectedValueOnce: (error) => {
    mockFetch.fn = () => Promise.reject(error);
    return mockFetch;
  },
  mockClear: () => {
    mockFetch.fn = () => {};
    mockFetch.calls = [];
  },
  calls: []
};

global.fetch = (...args) => {
  mockFetch.calls.push(args);
  return mockFetch.fn(...args);
};

const fetch = global.fetch;

beforeEach(() => {
  mockFetch.mockClear();
});

describe('TimeoutConfig', () => {
  test('creates with default values', () => {
    const config = new TimeoutConfig();
    expect(config.read).toBe(30000); // 30 seconds in ms
    expect(config.connect).toBe(10000); // 10 seconds in ms
  });

  test('creates with custom values', () => {
    const config = new TimeoutConfig(60, 20);
    expect(config.read).toBe(60000);
    expect(config.connect).toBe(20000);
  });
});

describe('HTTPClient', () => {
  test('creates with default configuration', () => {
    const client = new HTTPClient();
    expect(client.maxRetries).toBe(3);
    expect(client.closed).toBe(false);
  });

  test('creates with custom configuration', () => {
    const timeoutConfig = new TimeoutConfig(45, 15);
    const client = new HTTPClient(timeoutConfig, 5);
    expect(client.maxRetries).toBe(5);
    expect(client.timeoutConfig).toBe(timeoutConfig);
  });

  describe('request method', () => {
    test('makes successful GET request', async () => {
      const mockResponse = { data: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const client = new HTTPClient();
      const result = await client.request('GET', 'https://api.example.com/test');

      expect(result).toEqual(mockResponse);
      expect(mockFetch.calls.length).toBe(1);
      expect(mockFetch.calls[0][0]).toBe('https://api.example.com/test');
      expect(mockFetch.calls[0][1]).toEqual(expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'User-Agent': 'barndoor-js-sdk/0.1.0'
        })
      }));
    });

    test('makes POST request with JSON body', async () => {
      const mockResponse = { success: true };
      const requestData = { name: 'test' };
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const client = new HTTPClient();
      const result = await client.request('POST', 'https://api.example.com/test', {
        json: requestData
      });

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestData)
        })
      );
    });

    test('adds query parameters', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      const client = new HTTPClient();
      await client.request('GET', 'https://api.example.com/test', {
        params: { page: 1, limit: 10 }
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/test?page=1&limit=10',
        expect.any(Object)
      );
    });

    test('adds custom headers', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      });

      const client = new HTTPClient();
      await client.request('GET', 'https://api.example.com/test', {
        headers: { 'Authorization': 'Bearer token123' }
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer token123',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    test('throws HTTPError for HTTP error responses', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Resource not found')
      });

      const client = new HTTPClient();
      
      await expect(client.request('GET', 'https://api.example.com/test'))
        .rejects.toThrow(HTTPError);
      
      try {
        await client.request('GET', 'https://api.example.com/test');
      } catch (error) {
        expect(error.statusCode).toBe(404);
        expect(error.responseBody).toBe('Resource not found');
      }
    });

    test('throws TimeoutError for aborted requests', async () => {
      fetch.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));

      const client = new HTTPClient(new TimeoutConfig(0.001)); // Very short timeout
      
      await expect(client.request('GET', 'https://api.example.com/test'))
        .rejects.toThrow(TimeoutError);
    });

    test('throws ConnectionError for network errors', async () => {
      const networkError = new TypeError('Failed to fetch');
      fetch.mockRejectedValueOnce(networkError);

      const client = new HTTPClient();
      
      await expect(client.request('GET', 'https://api.example.com/test'))
        .rejects.toThrow(ConnectionError);
    });

    test('retries on network errors', async () => {
      const networkError = new TypeError('Failed to fetch');
      fetch
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });

      const client = new HTTPClient(new TimeoutConfig(), 2);
      const result = await client.request('GET', 'https://api.example.com/test');

      expect(result).toEqual({ success: true });
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    test('does not retry HTTP errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Invalid request')
      });

      const client = new HTTPClient(new TimeoutConfig(), 3);
      
      await expect(client.request('GET', 'https://api.example.com/test'))
        .rejects.toThrow(HTTPError);
      
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('throws error when client is closed', async () => {
      const client = new HTTPClient();
      await client.close();

      await expect(client.request('GET', 'https://api.example.com/test'))
        .rejects.toThrow('HTTP client has been closed');
    });
  });

  describe('URL building', () => {
    test('handles URLs without parameters', () => {
      const client = new HTTPClient();
      const url = client._buildUrl('https://api.example.com/test', null);
      expect(url).toBe('https://api.example.com/test');
    });

    test('handles empty parameters', () => {
      const client = new HTTPClient();
      const url = client._buildUrl('https://api.example.com/test', {});
      expect(url).toBe('https://api.example.com/test');
    });

    test('filters out null and undefined parameters', () => {
      const client = new HTTPClient();
      const url = client._buildUrl('https://api.example.com/test', {
        valid: 'value',
        nullParam: null,
        undefinedParam: undefined
      });
      expect(url).toBe('https://api.example.com/test?valid=value');
    });
  });

  describe('cleanup', () => {
    test('close() marks client as closed', async () => {
      const client = new HTTPClient();
      expect(client.closed).toBe(false);
      
      await client.close();
      expect(client.closed).toBe(true);
    });

    test('aclose() is alias for close()', async () => {
      const client = new HTTPClient();
      await client.aclose();
      expect(client.closed).toBe(true);
    });
  });
});
