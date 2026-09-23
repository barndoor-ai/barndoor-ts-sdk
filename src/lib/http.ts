/**
 * The fetch the generated client runs every request through.
 *
 * `Configuration.fetchApi` is the single choke point — runtime.ts calls
 * `(this.configuration.fetchApi || fetch)(...)` once, beneath the middleware
 * chain, so retries belong here rather than in a `Middleware`: a `post` hook
 * would see each attempt, and an `onError` hook cannot retry a response that
 * arrived successfully with a 503.
 */

/** Matches the generated `FetchAPI` type without importing from generated code. */
type FetchAPI = (url: string, init?: RequestInit) => Promise<Response>;

export interface RetryOptions {
  /** Attempts after the first. 0 disables retrying. */
  retries?: number;
  /** Per-attempt timeout in milliseconds. */
  timeoutMs?: number;
  /** Base for exponential backoff in milliseconds. */
  backoffMs?: number;
  /** Underlying fetch, for tests or a non-global implementation. */
  fetch?: FetchAPI;
}

/**
 * Statuses worth another attempt.
 *
 * 5xx generally, plus 429. 501 and 505 are excluded: the server understood the
 * request and will refuse it identically next time.
 */
function isRetryableStatus(status: number): boolean {
  if (status === 429) return true;
  return status >= 500 && status !== 501 && status !== 505;
}

/**
 * Only idempotent methods are retried.
 *
 * A 502 or 504 does not say whether the request reached the application — a
 * gateway can time out waiting for a response to work it already committed. So
 * retrying a POST risks a duplicate write, and silently doing that is worse
 * than surfacing the error. The hand-written SDK retried every method, which
 * was a latent double-write on any 5xx during a create.
 */
const IDEMPOTENT = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);

/** `Retry-After` is either seconds or an HTTP date; both are legal. */
function retryAfterMs(response: Response): number | null {
  const header = response.headers.get('retry-after');
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export function createFetch(options: RetryOptions = {}): FetchAPI {
  const { retries = 3, timeoutMs = 30_000, backoffMs = 250 } = options;
  const underlying = options.fetch ?? ((url, init) => globalThis.fetch(url, init));

  return async function fetchWithRetry(url, init = {}) {
    let lastError: unknown;

    for (let attempt = 0; ; attempt++) {
      // A fresh timeout per attempt, combined with whatever the caller passed so
      // their cancellation still wins and is never retried past.
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;

      let response: Response | undefined;
      try {
        response = await underlying(url, { ...init, signal });
      } catch (error) {
        lastError = error;
        // The caller aborted, or the request is not safe to repeat.
        if (init.signal?.aborted) throw error;
        if (!IDEMPOTENT.has((init.method ?? 'GET').toUpperCase())) throw error;
        if (attempt >= retries) throw error;
        await sleep(backoffMs * 2 ** attempt);
        continue;
      }

      if (
        attempt >= retries ||
        !isRetryableStatus(response.status) ||
        !IDEMPOTENT.has((init.method ?? 'GET').toUpperCase())
      ) {
        return response;
      }

      // The body is never read on a retried response, so release it rather than
      // leaking the connection.
      await response.body?.cancel().catch(() => undefined);
      await sleep(retryAfterMs(response) ?? backoffMs * 2 ** attempt);
    }
  };
}
