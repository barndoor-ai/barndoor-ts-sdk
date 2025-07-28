/**
 * Minimal Barndoor → MCP demo using the SDK quick-start helpers.
 * 
 * The only responsibilities left here are:
 * 
 * 1. Load environment variables so we get AGENT_CLIENT_ID / AGENT_CLIENT_SECRET.
 * 2. Call the SDK helpers to:
 *    • login & obtain a ready BarndoorSDK
 *    • make sure the chosen server is connected
 *    • prepare the MCP connection params (proxy URL + headers)
 * 3. Feed those params to **any** AI framework.
 * 
 * Environment
 * -----------
 * The helper automatically chooses the right hosts based on MODE
 * (localdev, development, production). For the shared DEV environment run:
 * 
 * ```
 * export MODE=development
 * ```
 * 
 * Run with:
 *     node examples/sample-salesforce-agent.js
 */

import { 
  loginInteractive, 
  ensureServerConnected, 
  makeMcpConnectionParams 
} from '../src/index.js';
import 'dotenv/config';

const SERVER_SLUG = 'salesforce'; // change to the MCP server you want

async function main() {
  try {
    // ---------------------------------------------------------------------
    // 0. Environment / login
    // ---------------------------------------------------------------------
    console.log('🔐 Starting interactive login...');
    const sdk = await loginInteractive(); // handles cached JWT, PKCE flow, etc.
    console.log('✅ Login successful!');

    // ---------------------------------------------------------------------
    // 1. List available servers for the current user
    // ---------------------------------------------------------------------
    const servers = await sdk.listServers();
    console.log('\n📋 Available MCP servers:');
    for (const server of servers) {
      console.log(`  • ${server.slug.padEnd(15)} status=${server.connection_status}`);
    }

    // ---------------------------------------------------------------------
    // 2. Ensure the target server is connected (will launch OAuth if not)
    // ---------------------------------------------------------------------
    console.log(`\n🔗 Ensuring ${SERVER_SLUG} server is connected...`);
    await ensureServerConnected(sdk, SERVER_SLUG);
    console.log(`✅ ${SERVER_SLUG} server is connected!`);

    // ---------------------------------------------------------------------
    // 3. Build connection params (works locally & in deployed envs)
    // ---------------------------------------------------------------------
    const [params, publicUrl] = await makeMcpConnectionParams(sdk, SERVER_SLUG);
    console.log(`✅ Ready – MCP URL: ${params.url}  (public: ${publicUrl})`);

    // ---------------------------------------------------------------------
    // 4. Demo MCP connection usage
    // ---------------------------------------------------------------------
    console.log('\n🔧 Connection parameters ready for AI framework:');
    console.log(`  URL: ${params.url}`);
    console.log(`  Transport: ${params.transport}`);
    console.log('  Headers:', Object.keys(params.headers).join(', '));

    // Example of typical MCP operations you might perform
    console.log('\n💡 Common Salesforce MCP operations:');
    console.log('  - List available Salesforce objects (Accounts, Contacts, etc.)');
    console.log('  - Query records with SOQL');
    console.log('  - Create, update, or delete records');
    console.log('  - Access Salesforce metadata');

    // In a real application, you would use these params with your preferred
    // AI framework to perform actual Salesforce operations
    console.log('\n📝 Example MCP request structure:');
    console.log(`
// List available resources
const listResourcesRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'resources/list'
};

// Query Salesforce accounts
const queryRequest = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: {
    name: 'query_records',
    arguments: {
      query: 'SELECT Id, Name, Industry FROM Account LIMIT 10'
    }
  }
};

// Send requests to: ${params.url}
// With headers: ${JSON.stringify(params.headers, null, 2)}
    `);

    await sdk.close();
    console.log('\n✅ Salesforce MCP demo completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the main function
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
