/**
 * Connect to Barndoor's MCP endpoint and list the tools it exposes.
 *
 * Every call is authenticated with the same credentials as the REST client and
 * recorded in your organization's audit trail.
 *
 * Run: BARNDOOR_API_KEY=bdai_… BARNDOOR_ORG=acme npx tsx mcp-client.ts
 */
import { createClient, createMcpClient } from '@barndoor-ai/sdk';

const apiKey = process.env.BARNDOOR_API_KEY;
const orgSlug = process.env.BARNDOOR_ORG;
if (!apiKey || !orgSlug) throw new Error('Set BARNDOOR_API_KEY and BARNDOOR_ORG');

const client = createClient({ auth: apiKey });
const mcp = await createMcpClient(client, orgSlug, undefined, {
  clientInfo: { name: 'mcp-client-example', version: '1.0.0' },
});

const { tools } = await mcp.listTools();
for (const tool of tools) {
  console.log(`${tool.name} — ${tool.description ?? 'no description'}`);
}

await mcp.close();
