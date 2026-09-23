import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { BASE_PATH } from '../runtime.js';
import { type BarndoorClient } from './client.js';

/**
 * Connecting to an MCP server through Barndoor.
 *
 * This is the one capability the spec cannot describe: MCP is a different
 * protocol over its own transport, and nothing in an OpenAPI document says a
 * server is reachable at /mcp or what headers that needs. The REST half is used
 * only to exchange a server id for a slug.
 */
export interface McpOptions {
  /**
   * The host serving MCP, WITHOUT the organization subdomain. Defaults to the
   * client's API base URL, since one vhost serves both `/api` and `/mcp`.
   */
  baseUrl?: string;
  /** Correlates every call in one session in Barndoor's audit trail. */
  sessionId?: string;
  /** Reported to the MCP server during initialisation. */
  clientInfo?: { name: string; version: string };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `crypto.randomUUID` is undefined outside a secure context, so a browser
 * served over plain HTTP would throw rather than produce a session id.
 */
function newSessionId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Put the tenant in front of the host: platform.example.com -> acme.platform.example.com */
function withOrganization(baseUrl: string, orgSlug: string): URL {
  const url = new URL(baseUrl);
  url.hostname = `${orgSlug}.${url.hostname}`;
  return url;
}

/**
 * A server id is exchanged for its slug; a slug is used as given.
 *
 * The MCP endpoint addresses servers by slug only, and the two are told apart
 * by shape — which is what the REST API does with its `{server_id}` and
 * `by-slug/{slug}` routes.
 */
async function resolveSlug(client: BarndoorClient, serverIdOrSlug: string): Promise<string> {
  if (!UUID.test(serverIdOrSlug)) return serverIdOrSlug;
  const server = await client.registry.getMcpServer({ serverId: serverIdOrSlug });
  if (!server.slug) {
    throw new Error(`Server ${serverIdOrSlug} has no slug, so it cannot be reached over MCP`);
  }
  return server.slug;
}

/** The URL and headers an MCP transport needs, for callers wiring their own. */
export async function mcpConnectionParams(
  client: BarndoorClient,
  orgSlug: string,
  serverIdOrSlug?: string,
  options: McpOptions = {}
): Promise<{ url: string; headers: Record<string, string> }> {
  if (!orgSlug) {
    throw new Error('An organization slug is required: it selects the tenant serving MCP');
  }

  const url = withOrganization(options.baseUrl ?? client.configuration.basePath ?? BASE_PATH, orgSlug);

  // Omitting the server connects to the universal endpoint, which exposes every
  // server the caller can reach as one surface. Naming one connects directly to
  // just that server.
  url.pathname = serverIdOrSlug ? `/mcp/${await resolveSlug(client, serverIdOrSlug)}` : '/mcp';

  // The same provider the generated operations authenticate with, so an MCP
  // session cannot end up on a different or stale credential.
  const accessToken = client.configuration.accessToken;
  if (!accessToken) {
    throw new Error('This client has no credential, so it cannot open an MCP session');
  }

  return {
    url: url.href,
    headers: {
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${await accessToken('OAuth2', [])}`,
      'x-barndoor-session-id': options.sessionId ?? newSessionId(),
    },
  };
}

/**
 * Open a connected MCP session.
 *
 * Omit `serverIdOrSlug` for the universal endpoint (`/mcp`), which exposes
 * every server the caller can reach; pass one to connect directly to a single
 * server (`/mcp/<slug>`). A server id is accepted and exchanged for its slug.
 *
 * Returns the official `@modelcontextprotocol/sdk` client, already through
 * `initialize`, so callers use the MCP API directly rather than anything
 * Barndoor-shaped. Close it with `client.close()`.
 */
export async function createMcpClient(
  client: BarndoorClient,
  orgSlug: string,
  serverIdOrSlug?: string,
  options: McpOptions = {}
): Promise<McpClient> {
  const { url, headers } = await mcpConnectionParams(client, orgSlug, serverIdOrSlug, options);

  const mcp = new McpClient(options.clientInfo ?? { name: 'barndoor-sdk', version: '0.1.0' });
  const transport = new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers } });

  await mcp.connect(transport);
  return mcp;
}
