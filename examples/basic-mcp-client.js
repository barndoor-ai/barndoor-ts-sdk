/**
 * Basic MCP Client Example
 *
 * This script demonstrates how to use the Barndoor SDK to connect to MCP servers
 * and perform basic operations without any AI framework dependencies.
 */

import 'dotenv/config';
import {
  loginInteractive,
  ensureServerConnected,
  makeMcpClient,
  BarndoorSDK,
  getDynamicConfig,
  getStaticConfig,
  hasOrganizationInfo,
} from '../dist/index.esm.js';

const SERVER_SLUG = 'salesforce'; // or 'notion'

async function main() {
  try {
    console.log('🚀 Starting Basic MCP Client Example...\n');

    // ---------------------------------------------------------------------
    // 1. Initialize Barndoor SDK and MCP client (with retry on 401)
    // ---------------------------------------------------------------------
    console.log('🔐 Authenticating with Barndoor...');

    let sdk;
    const envToken = process.env['BARNDOOR_ACCESS_TOKEN'];
    if (envToken) {
      console.log('🔑 Using token from BARNDOOR_ACCESS_TOKEN');
      const cfg = hasOrganizationInfo(envToken) ? getDynamicConfig(envToken) : getStaticConfig();
      sdk = new BarndoorSDK(cfg.apiBaseUrl, { token: envToken });
      await sdk.listServers();
      console.log('✅ Authentication successful (env token)!');
    } else {
      sdk = await loginInteractive();
      // Test authentication by trying to list servers
      try {
        await sdk.listServers();
        console.log('✅ Authentication successful!');
      } catch (error) {
        if (error.statusCode === 401) {
          console.log('⚠️  Cached token invalid, clearing and re-authenticating...');
          // Clear cached token and try again
          const { clearCachedToken } = await import('../dist/index.esm.js');
          clearCachedToken();
          sdk = await loginInteractive();
          await sdk.listServers(); // Test again
          console.log('✅ Re-authentication successful!');
        } else {
          throw error;
        }
      }
    }

    console.log(`\n🔗 Ensuring ${SERVER_SLUG} server is connected...`);
    await ensureServerConnected(sdk, SERVER_SLUG);
    console.log(`✅ ${SERVER_SLUG} server connected!`);

    // Use the makeMcpClient helper
    const mcpClient = await makeMcpClient(sdk, SERVER_SLUG);
    console.log('📡 MCP client connected!');

    // ---------------------------------------------------------------------
    // 2. List available resources and tools using SDK
    // ---------------------------------------------------------------------
    console.log('\n📋 Listing available resources...');
    try {
      const { resources = [] } = await mcpClient.listResources();
      console.log(`Found ${resources.length} resources`);
    } catch (error) {
      console.log('⚠️  List resources failed:', error.message);
    }

    console.log('\n🔧 Listing available tools...');
    try {
      const { tools = [] } = await mcpClient.listTools();
      console.log(`Found ${tools.length} tools`);
      tools.forEach((tool, i) => {
        console.log(`  ${i + 1}. ${tool.name}: ${tool.description || 'No description'}`);
      });
    } catch (error) {
      console.log('⚠️  List tools failed:', error.message);
    }

    // ---------------------------------------------------------------------
    // 3. Test specific operations
    // ---------------------------------------------------------------------
    console.log('\n🧪 Testing specific operations...');

    if (SERVER_SLUG === 'salesforce') {
      console.log('\n📊 Testing Salesforce operations...');
      try {
        const queryResponse = await mcpClient.callTool({
          name: 'query_records',
          arguments: {
            query: 'SELECT Id, Name, Industry FROM Account LIMIT 5',
          },
        });
        const records =
          queryResponse?.content?.[0]?.type === 'text'
            ? JSON.parse(queryResponse.content[0].text)
            : queryResponse.records || [];
        console.log(`Found ${records.length} accounts`);
        records.forEach((record, i) => {
          console.log(`  ${i + 1}. ${record.Name} (${record.Industry || 'No industry'})`);
        });
      } catch (error) {
        console.log('⚠️  Salesforce query failed:', error.message);
      }
    } else if (SERVER_SLUG === 'notion') {
      console.log('\n📝 Testing Notion operations...');
      try {
        const pagesResponse = await mcpClient.callTool({
          name: 'list_pages',
          arguments: {},
        });
        const pages = pagesResponse?.pages || [];
        console.log(`Found ${pages.length} pages`);
        pages.slice(0, 5).forEach((page, i) => {
          console.log(`  ${i + 1}. ${page.title || 'Untitled'}`);
        });
      } catch (error) {
        console.log('⚠️  Notion operation failed:', error.message);
      }
    }

    await mcpClient.close();
    await sdk.close();
    console.log('\n✅ Basic MCP client example completed successfully!');
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
