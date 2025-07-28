/**
 * Direct MCP HTTP Test
 * 
 * This script demonstrates how to use the Barndoor SDK to get MCP connection params
 * and then make direct HTTP requests to test real MCP operations.
 */

import 'dotenv/config';
import { 
  loginInteractive, 
  ensureServerConnected, 
  makeMcpClient 
} from '../src/index.js';

const SERVER_SLUG = 'salesforce'; // or 'notion'

async function makeMcpRequest(url, headers, method, params = null) {
  const body = params ? JSON.stringify(params) : null;
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      'x-mcp-server-name': SERVER_SLUG
    },
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return await response.json();
}

async function main() {
  try {
    console.log('🚀 Starting Direct MCP HTTP Test...\n');

    // ---------------------------------------------------------------------
    // 1. Initialize Barndoor SDK and MCP client
    // ---------------------------------------------------------------------
    console.log('🔐 Authenticating with Barndoor...');
    const sdk = await loginInteractive();
    console.log('✅ Authentication successful!');

    console.log(`\n🔗 Ensuring ${SERVER_SLUG} server is connected...`);
    await ensureServerConnected(sdk, SERVER_SLUG);
    console.log(`✅ ${SERVER_SLUG} server connected!`);

    // Use new helper
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
            query: 'SELECT Id, Name, Industry FROM Account LIMIT 5'
          }
        });
        const records = queryResponse?.content?.[0]?.type === 'text' ? JSON.parse(queryResponse.content[0].text) : (queryResponse.records || []);
        console.log(`Found ${records.length} accounts`);
      } catch (error) {
        console.log('⚠️  Salesforce query failed:', error.message);
      }
    } else if (SERVER_SLUG === 'notion') {
      console.log('\n📝 Testing Notion operations...');
      try {
        const pagesResponse = await mcpClient.callTool({
          name: 'list_pages',
          arguments: {}
        });
        const pages = pagesResponse?.pages || [];
        console.log(`Found ${pages.length} pages`);
      } catch (error) {
        console.log('⚠️  Notion operation failed:', error.message);
      }
    }

    await mcpClient.close();
    console.log('\n✅ Direct MCP test completed successfully!');
    return;

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