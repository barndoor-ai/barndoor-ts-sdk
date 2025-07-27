/**
 * Minimal Barndoor → MCP demo for a Notion integration.
 * 
 * This script mirrors the Python `sample_notion_agent.py` but uses the JavaScript SDK.
 * It demonstrates how to:
 * 
 * 1. Load credentials from environment variables (expects `AUTH_DOMAIN`, `AGENT_CLIENT_ID`, and `AGENT_CLIENT_SECRET`).
 * 2. Use the Barndoor SDK helpers to:
 *    • log in interactively
 *    • ensure the Notion server connection is established (launches OAuth if needed)
 *    • obtain connection parameters (proxy URL + headers)
 * 3. Feed those params to **any** AI framework – here we show a basic example.
 * 
 * Environment:
 *     export MODE=development  # or production / localdev
 * 
 * Run with:
 *     node examples/sample-notion-agent.js
 */

import { 
  loginInteractive, 
  ensureServerConnected, 
  makeMcpConnectionParams 
} from '../src/index.js';

const SERVER_SLUG = 'notion'; // target MCP server for this sample

async function main() {
  try {
    // ------------------------------------------------------------------
    // 0. Environment / login
    // ------------------------------------------------------------------
    console.log('🔐 Starting interactive login...');
    const sdk = await loginInteractive(); // handles cached JWT, PKCE flow, etc.
    console.log('✅ Login successful!');

    // ------------------------------------------------------------------
    // 1. List available servers for the current user
    // ------------------------------------------------------------------
    const servers = await sdk.listServers();
    console.log('\n📋 Available MCP servers:');
    for (const server of servers) {
      console.log(`  • ${server.slug.padEnd(12)} status=${server.connection_status}`);
    }

    // ------------------------------------------------------------------
    // 2. Ensure the Notion server is connected (will launch OAuth if not)
    // ------------------------------------------------------------------
    console.log(`\n🔗 Ensuring ${SERVER_SLUG} server is connected...`);
    await ensureServerConnected(sdk, SERVER_SLUG);
    console.log(`✅ ${SERVER_SLUG} server is connected!`);

    // ------------------------------------------------------------------
    // 3. Build connection params (works locally & in deployed envs)
    // ------------------------------------------------------------------
    const [params, publicUrl] = await makeMcpConnectionParams(sdk, SERVER_SLUG);
    console.log(`✅ Ready – MCP URL: ${params.url}  (public: ${publicUrl})`);

    // ------------------------------------------------------------------
    // 4. Basic MCP connection demo
    // ------------------------------------------------------------------
    console.log('\n🔧 Connection parameters:');
    console.log(`  URL: ${params.url}`);
    console.log(`  Transport: ${params.transport}`);
    console.log(`  Headers: ${JSON.stringify(params.headers, null, 2)}`);

    // In a real application, you would use these params with your preferred
    // AI framework (LangChain, CrewAI, custom implementation, etc.)
    console.log('\n💡 These parameters can now be used with any MCP-compatible framework:');
    console.log('  - LangChain MCP integration');
    console.log('  - CrewAI MCPServerAdapter');
    console.log('  - Custom MCP client implementation');
    console.log('  - Direct HTTP requests to the MCP endpoint');

    // Example of how you might use this with a custom HTTP client:
    console.log('\n📝 Example usage with fetch:');
    console.log(`
const response = await fetch('${params.url}/list_resources', {
  method: 'POST',
  headers: ${JSON.stringify(params.headers, null, 2)},
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'resources/list'
  })
});

const mcpResponse = await response.json();
console.log('Available resources:', mcpResponse.result);
    `);

    await sdk.close();
    console.log('\n✅ Demo completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
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
