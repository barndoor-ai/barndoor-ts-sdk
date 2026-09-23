import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

import {
  completeAuthorizationCode,
  startAuthorizationCode,
  type AuthorizationCodeOptions,
  type TokenProvider,
} from './auth.js';

/**
 * Interactive login for command-line tools.
 *
 * NODE ONLY. This module binds a local port and launches a browser, neither of
 * which exists in a browser runtime, so it is published under the `/cli`
 * subpath rather than the package root — importing the root must not drag
 * `node:http` into a bundle.
 *
 * Everything here is orchestration. The flow itself is
 * {@link startAuthorizationCode} and {@link completeAuthorizationCode}, which
 * work without any of this; the listener only saves the user from copying a URL
 * out of the address bar.
 */
export interface InteractiveLoginOptions extends Omit<AuthorizationCodeOptions, 'redirectUri'> {
  /**
   * Must match a redirect URI registered on the OAuth client, which is an exact
   * comparison at the authorization server — a port it does not know about is
   * rejected before the user sees a login page. Matches the port the
   * hand-written SDK used.
   */
  port?: number;
  /** Give up if the user never finishes. */
  timeoutMs?: number;
  /** Set false to skip launching a browser, leaving the user to open the URL. */
  openBrowser?: boolean;
  /**
   * Where the sign-in URL goes. Defaults to stdout.
   *
   * A library should not write to the console with no way to intercept it:
   * a caller rendering a TUI, logging structurally, or driving this from a test
   * needs the URL as a value rather than as output.
   */
  onUrl?: (url: string) => void;
}

/** Best-effort browser launch. Failure is not fatal — the URL is printed too. */
function openInBrowser(url: string): void {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    spawn(command, [url], { detached: true, stdio: 'ignore', shell: process.platform === 'win32' })
      .on('error', () => undefined)
      .unref();
  } catch {
    // Headless, sandboxed, or no handler registered. The printed URL still works.
  }
}

/**
 * Wait for the authorization server to redirect the user back.
 *
 * Resolves with the full callback URL — query string included — which is what
 * the exchange needs in order to check `state` and read the code.
 */
function awaitCallback(port: number, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);
      // The browser asks for /favicon.ico alongside the real callback; answering
      // that one as if it were the redirect would resolve with no code at all.
      if (!url.searchParams.has('code') && !url.searchParams.has('error')) {
        res.writeHead(404).end();
        return;
      }

      const failed = url.searchParams.get('error');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(
        `<!doctype html><meta charset="utf-8"><title>Barndoor</title>
         <body style="font:16px system-ui;padding:3rem;text-align:center">
         <p>${failed ? `Sign-in failed: ${failed}` : 'Signed in. You can close this window.'}</p>`
      );

      // Close after responding, so the browser is not left waiting on a socket
      // that never finishes.
      server.close();
      if (failed) {
        reject(new Error(`Authorization failed: ${failed}${url.searchParams.get('error_description') ? ` — ${url.searchParams.get('error_description')}` : ''}`));
      } else {
        resolve(url.href);
      }
    });

    const timer = setTimeout(() => {
      server.close();
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for the browser to come back`));
    }, timeoutMs);
    timer.unref?.();

    server.once('close', () => clearTimeout(timer));
    server.on('error', error => {
      clearTimeout(timer);
      reject(
        new Error(
          `Could not listen on port ${port} (${(error as NodeJS.ErrnoException).code}). ` +
            'Free the port, pass a different one that is also registered on the OAuth client, or ' +
            'use startAuthorizationCode/completeAuthorizationCode directly.'
        )
      );
    });

    // Loopback only. Binding every interface would expose the authorization code
    // to anything else on the network for the life of the login.
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Log a user in and return a self-refreshing {@link TokenProvider}.
 *
 * Opens a browser, catches the redirect on a local port, and exchanges the
 * code. The OAuth client is the caller's: its id, and a redirect URI of
 * `http://localhost:<port>/callback`, must be registered with the
 * authorization server first.
 */
export async function loginInteractive(
  options: InteractiveLoginOptions
): Promise<TokenProvider> {
  const {
    port = 52765,
    timeoutMs = 300_000,
    openBrowser = true,
    onUrl = url => console.log(`\nOpen this to sign in:\n\n${url}\n`),
    ...auth
  } = options;
  const redirectUri = `http://localhost:${port}/callback`;

  const request = await startAuthorizationCode({ ...auth, redirectUri });

  // Listen BEFORE sending the user anywhere: a fast redirect against a server
  // that is not up yet is a connection refused the user sees instead of a login.
  const callback = awaitCallback(port, timeoutMs);

  if (openBrowser) openInBrowser(request.authorizationUrl);
  onUrl(request.authorizationUrl);

  const { getToken } = await completeAuthorizationCode({
    ...auth,
    redirectUri,
    callbackUrl: await callback,
    codeVerifier: request.codeVerifier,
    state: request.state,
  });
  return getToken;
}
