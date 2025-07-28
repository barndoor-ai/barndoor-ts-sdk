/**
 * MCP Request Format Test
 * 
 * This script tests different MCP request formats to find the correct one.
 */

import 'dotenv/config';
import { 
  loginInteractive, 
  ensureServerConnected, 
  makeMcpConnectionParams 
} from '../src/index.js';

const SERVER_SLUG = 'salesforce';

async function testMcpRequest(url, headers, requestBody) {
  console.log(`\n🔍 Testing request format:`);
  console.log(`URL: ${url}`);
  console.log(`Body:`, JSON.stringify(requestBody, null, 2));
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        'x-mcp-server-name': SERVER_SLUG
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success:', JSON.stringify(data, null, 2));
      return data;
    } else {
      const errorText = await response.text();
      console.log('❌ Error:', errorText);
      return null;
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
    return null;
  }
}

async function main() {
  try {
    console.log('🔍 MCP Request Format Test...\n');

    // Get MCP connection params
    const sdk = await loginInteractive();
    await ensureServerConnected(sdk, SERVER_SLUG);
    const [mcpParams, publicUrl] = await makeMcpConnectionParams(sdk, SERVER_SLUG);
    
    console.log(`📡 Base URL: ${mcpParams.url}`);

    // Test different request formats
    const testRequests = [
      // Standard JSON-RPC format
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      },
      
      // With mcp_server_name in params
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {
          mcp_server_name: SERVER_SLUG
        }
      },
      
      // With mcp_server_name at top level
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/list',
        params: {},
        mcp_server_name: SERVER_SLUG
      },
      
      // Initialize request
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {}
          },
          clientInfo: {
            name: 'barndoor-test-client',
            version: '1.0.0'
          }
        }
      },
      
      // Initialize with mcp_server_name
      {
        jsonrpc: '2.0',
        id: 5,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {}
          },
          clientInfo: {
            name: 'barndoor-test-client',
            version: '1.0.0'
          },
          mcp_server_name: SERVER_SLUG
        }
      }
    ];

    for (const request of testRequests) {
      await testMcpRequest(mcpParams.url, mcpParams.headers, request);
    }

    await sdk.close();
    console.log('\n✅ Request format test completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 