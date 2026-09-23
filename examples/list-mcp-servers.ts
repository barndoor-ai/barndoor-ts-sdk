/**
 * List the MCP servers registered in your organization.
 *
 * Run: BARNDOOR_API_KEY=bdai_… npx tsx list-mcp-servers.ts
 */
import { createClient } from '@barndoor-ai/sdk';

const apiKey = process.env.BARNDOOR_API_KEY;
if (!apiKey) throw new Error('Set BARNDOOR_API_KEY');

const client = createClient({ auth: apiKey });

const { data, pagination } = await client.registry.listMcpServers({});

for (const server of data) {
  console.log(`${server.name}  (${server.slug})`);
}
console.log(`\n${data.length} of ${pagination.total} server(s)`);
