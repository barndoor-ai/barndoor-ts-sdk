/**
 * Authenticate with client credentials rather than an API key.
 *
 * The token is obtained on the first request and refreshed before it expires —
 * there is nothing to schedule or cache yourself.
 *
 * Run: BARNDOOR_CLIENT_ID=… BARNDOOR_CLIENT_SECRET=… npx tsx machine-to-machine.ts
 */
import { createClient } from '@barndoor-ai/sdk';

const clientId = process.env.BARNDOOR_CLIENT_ID;
const clientSecret = process.env.BARNDOOR_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  throw new Error('Set BARNDOOR_CLIENT_ID and BARNDOOR_CLIENT_SECRET');
}

const client = createClient({ auth: { clientId, clientSecret } });

const { data } = await client.registry.listMcpServers({ limit: 5 });
console.log(data.map((s) => s.name));
