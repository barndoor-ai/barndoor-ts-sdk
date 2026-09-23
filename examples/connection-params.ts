/**
 * Get MCP connection details without opening a connection, so another
 * framework — CrewAI, LangChain, your own client — can do the connecting.
 *
 * Run: BARNDOOR_API_KEY=bdai_… BARNDOOR_ORG=acme npx tsx connection-params.ts
 */
import { createClient, mcpConnectionParams } from '@barndoor-ai/sdk';

const apiKey = process.env.BARNDOOR_API_KEY;
const orgSlug = process.env.BARNDOOR_ORG;
if (!apiKey || !orgSlug) throw new Error('Set BARNDOOR_API_KEY and BARNDOOR_ORG');

const client = createClient({ auth: apiKey });
const { url, headers } = await mcpConnectionParams(client, orgSlug);

// `headers` carries a bearer token. Treat it as a secret.
console.log('url:', url);
console.log('headers:', Object.keys(headers).join(', '));
