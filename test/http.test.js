/**
 * Retry policy — the behaviour that decides whether a write can happen twice.
 */
import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';

import { createFetch } from '../dist/esm/index.js';

/** A fetch that records its calls and replays a scripted sequence of responses. */
function stubFetch(responses) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET', signal: init.signal });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)];
    if (next instanceof Error) throw next;
    return new Response(next.body ?? '', { status: next.status, headers: next.headers });
  };
  return { fetch, calls };
}

describe('which failures are retried', () => {
  test('a 503 on GET is retried up to the limit', async () => {
    const { fetch, calls } = stubFetch([{ status: 503 }]);
    const response = await createFetch({ retries: 2, backoffMs: 1, fetch })('https://x.test/', { method: 'GET' });

    assert.equal(calls.length, 3, 'expected the original plus two retries');
    assert.equal(response.status, 503, 'the last response is returned, not an error');
  });

  test('a 503 on POST is NOT retried', async () => {
    // A 502 or 504 does not say whether the request reached the application —
    // a gateway can time out waiting on work it already committed. Retrying a
    // POST is therefore a possible duplicate write.
    const { fetch, calls } = stubFetch([{ status: 503 }]);
    await createFetch({ retries: 2, backoffMs: 1, fetch })('https://x.test/', { method: 'POST' });

    assert.equal(calls.length, 1);
  });

  test('PUT and DELETE are retried, being idempotent', async () => {
    for (const method of ['PUT', 'DELETE']) {
      const { fetch, calls } = stubFetch([{ status: 500 }]);
      await createFetch({ retries: 1, backoffMs: 1, fetch })('https://x.test/', { method });
      assert.equal(calls.length, 2, `${method} should retry`);
    }
  });

  test('a 4xx is not retried', async () => {
    const { fetch, calls } = stubFetch([{ status: 404 }]);
    await createFetch({ retries: 2, backoffMs: 1, fetch })('https://x.test/', { method: 'GET' });

    assert.equal(calls.length, 1);
  });

  test('501 and 505 are not retried despite being 5xx', async () => {
    // The server understood the request and will refuse it identically.
    for (const status of [501, 505]) {
      const { fetch, calls } = stubFetch([{ status }]);
      await createFetch({ retries: 2, backoffMs: 1, fetch })('https://x.test/', { method: 'GET' });
      assert.equal(calls.length, 1, `${status} should not retry`);
    }
  });

  test('429 is retried', async () => {
    const { fetch, calls } = stubFetch([{ status: 429 }]);
    await createFetch({ retries: 1, backoffMs: 1, fetch })('https://x.test/', { method: 'GET' });

    assert.equal(calls.length, 2);
  });

  test('a network error on GET is retried, and rethrown when attempts run out', async () => {
    const { fetch, calls } = stubFetch([new TypeError('connection refused')]);
    await assert.rejects(
      () => createFetch({ retries: 2, backoffMs: 1, fetch })('https://x.test/', { method: 'GET' }),
      /connection refused/
    );
    assert.equal(calls.length, 3);
  });

  test('a network error on POST is rethrown immediately', async () => {
    const { fetch, calls } = stubFetch([new TypeError('connection refused')]);
    await assert.rejects(() =>
      createFetch({ retries: 2, backoffMs: 1, fetch })('https://x.test/', { method: 'POST' })
    );
    assert.equal(calls.length, 1);
  });
});

describe('recovery and cancellation', () => {
  test('a retry that succeeds returns the successful response', async () => {
    const { fetch, calls } = stubFetch([{ status: 503 }, { status: 200, body: 'ok' }]);
    const response = await createFetch({ retries: 3, backoffMs: 1, fetch })('https://x.test/', { method: 'GET' });

    assert.equal(response.status, 200);
    assert.equal(calls.length, 2, 'stops as soon as it succeeds');
  });

  test('retries stop once the caller aborts', async () => {
    const controller = new AbortController();
    const { fetch, calls } = stubFetch([new TypeError('aborted')]);
    const aborting = async (url, init) => {
      controller.abort();
      return fetch(url, init);
    };

    await assert.rejects(() =>
      createFetch({ retries: 3, backoffMs: 1, fetch: aborting })('https://x.test/', {
        method: 'GET',
        signal: controller.signal,
      })
    );
    assert.equal(calls.length, 1, 'an aborted request is not retried');
  });

  test('retrying zero times issues exactly one request', async () => {
    const { fetch, calls } = stubFetch([{ status: 503 }]);
    await createFetch({ retries: 0, backoffMs: 1, fetch })('https://x.test/', { method: 'GET' });

    assert.equal(calls.length, 1);
  });

  test('each attempt is given a signal even when the caller passes none', async () => {
    const { fetch, calls } = stubFetch([{ status: 200 }]);
    await createFetch({ fetch })('https://x.test/', { method: 'GET' });

    assert.ok(calls[0].signal, 'the per-attempt timeout must always be wired');
  });
});
