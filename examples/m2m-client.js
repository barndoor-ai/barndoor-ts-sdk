/**
 * Minimal machine-to-machine example using OAuth client credentials.
 *
 * Demonstrates the headless flow: fetch a JWT via OAuth client
 * credentials, list MCP servers, and tear down cleanly. Suitable for
 * backend services, scheduled jobs, or CI pipelines where no user is
 * present to complete the interactive PKCE flow.
 *
 * Environment variables:
 *
 *   BARNDOOR_API_BASE_URL      Platform API host for the caller's organization,
 *                              NOT the auth/control-plane host. For trial
 *                              tenants this is
 *                              https://{org_slug}.platform.barndoor.ai; for
 *                              enterprise tenants it is
 *                              https://{org_slug}.mcp.barndoor.ai. The
 *                              org_slug is encoded in the issued JWT's
 *                              `organization_name` claim.
 *   BARNDOOR_AUTH_ISSUER       OIDC issuer URL,
 *                              e.g. https://auth.barndoor.ai/realms/barndoor
 *   BARNDOOR_M2M_CLIENT_ID     OAuth client ID of a confidential Keycloak/Auth0
 *                              client with "Service Accounts" enabled.
 *   BARNDOOR_M2M_CLIENT_SECRET OAuth client secret for that client.
 *   BARNDOOR_API_AUDIENCE      Defaults to "https://barndoor.ai/".
 */

import { BarndoorSDK } from '@barndoor-ai/sdk';

async function main() {
  const baseUrl = process.env.BARNDOOR_API_BASE_URL;
  const issuer = process.env.BARNDOOR_AUTH_ISSUER;
  const clientId = process.env.BARNDOOR_M2M_CLIENT_ID;
  const clientSecret = process.env.BARNDOOR_M2M_CLIENT_SECRET;
  const audience = process.env.BARNDOOR_API_AUDIENCE ?? 'https://barndoor.ai/';

  if (!baseUrl || !issuer || !clientId || !clientSecret) {
    throw new Error(
      'Missing required env vars: BARNDOOR_API_BASE_URL, BARNDOOR_AUTH_ISSUER, ' +
        'BARNDOOR_M2M_CLIENT_ID, BARNDOOR_M2M_CLIENT_SECRET'
    );
  }

  const sdk = await BarndoorSDK.fromClientCredentials(baseUrl, {
    clientId,
    clientSecret,
    audience,
    issuer,
  });

  try {
    const servers = await sdk.listServers();
    for (const s of servers) {
      console.log(`${s.slug.padEnd(30)} ${s.connection_status}`);
    }
  } finally {
    await sdk.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
