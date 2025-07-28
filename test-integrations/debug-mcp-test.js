/**
 * Debug MCP test - figure out exact proxy requirements
 */

import 'dotenv/config';
import { 
  loginInteractive, 
  ensureServerConnected, 
  makeMcpConnectionParams 
} from '../src/index.js';

const SERVER_SLUG = 'salesforce';

async function testRequest(url, headers, body, description) {
  console.log(`\n🔍 ${description}`);
  console.log(`URL: ${url}`);
  console.log(`Headers:`, headers);
  console.log(`Body:`, JSON.stringify(body, null, 2));
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success!');
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
  const sdk = await loginInteractive();
  await ensureServerConnected(sdk, SERVER_SLUG);
  const [mcpParams] = await makeMcpConnectionParams(sdk, SERVER_SLUG);
  
  console.log(`\n📡 MCP URL from SDK: ${mcpParams.url}`);
  console.log(`📋 Headers from SDK:`, Object.keys(mcpParams.headers));

  // Test 1: Exactly what Python does - header only
  await testRequest(
    `${mcpParams.url}/tools/list`,
    {
      'Content-Type': 'application/json',
      ...mcpParams.headers,
      'x-mcp-server-name': SERVER_SLUG
    },
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    },
    'Test 1: Header only (like Python)'
  );

  // Test 2: With mcp_server_name in params
  await testRequest(
    `${mcpParams.url}/tools/list`,
    {
      'Content-Type': 'application/json',
      ...mcpParams.headers
    },
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {
        mcp_server_name: SERVER_SLUG
      }
    },
    'Test 2: Param only (no header)'
  );

  // Test 3: Both header and param
  await testRequest(
    `${mcpParams.url}/tools/list`,
    {
      'Content-Type': 'application/json',
      ...mcpParams.headers,
      'x-mcp-server-name': SERVER_SLUG
    },
    {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/list',
      params: {
        mcp_server_name: SERVER_SLUG
      }
    },
    'Test 3: Both header and param'
  );

  await sdk.close();
}

main().catch(console.error); 