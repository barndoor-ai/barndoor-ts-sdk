/**
 * Simple MCP Endpoint Explorer
 * 
 * This script explores what MCP endpoints are actually available
 * and what the correct request format should be.
 */

import 'dotenv/config';
import { 
  loginInteractive, 
  ensureServerConnected, 
  makeMcpConnectionParams 
} from '../src/index.js';

const SERVER_SLUG = 'salesforce';

async function testEndpoint(baseUrl, headers, endpoint, method = 'POST', body = null) {
  const url = `${baseUrl}${endpoint}`;
  console.log(`\n🔍 Testing: ${method} ${url}`);
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: body ? JSON.stringify(body) : null
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
    console.log('🔍 MCP Endpoint Explorer...\n');

    // Get MCP connection params
    const sdk = await loginInteractive();
    await ensureServerConnected(sdk, SERVER_SLUG);
    const [mcpParams, publicUrl] = await makeMcpConnectionParams(sdk, SERVER_SLUG);
    
    console.log(`📡 Base URL: ${mcpParams.url}`);
    console.log(`🔑 Headers:`, Object.keys(mcpParams.headers));

    // Test various possible endpoints
    const endpoints = [
      '/',
      '/initialize',
      '/tools/list',
      '/resources/list',
      '/tools/call',
      '/resources/read',
      '/mcp/initialize',
      '/mcp/tools/list',
      '/mcp/resources/list',
      // Try with server name in path
      '/salesforce/',
      '/salesforce/initialize',
      '/salesforce/tools/list',
      '/salesforce/resources/list',
      '/salesforce/tools/call',
      '/salesforce/resources/read'
    ];

    for (const endpoint of endpoints) {
      await testEndpoint(mcpParams.url, { ...mcpParams.headers, 'x-mcp-server-name': SERVER_SLUG }, endpoint);
    }

    // Test a simple tools call
    console.log('\n🧪 Testing tools call...');
    await testEndpoint(mcpParams.url, mcpParams.headers, '/tools/call', 'POST', {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'query_records',
        arguments: {
          query: 'SELECT Id, Name FROM Account LIMIT 1'
        }
      }
    });

    await sdk.close();
    console.log('\n✅ Endpoint exploration completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 