/**
 * 🔗 Universal Barndoor MCP Client
 *
 * Lets the user pick any available MCP server, list its tools,
 * and run a custom prompt / command interactively — no hardcoded Salesforce or Notion.
 */

import 'dotenv/config';
import readline from 'readline/promises';
import {
  loginInteractive,
  ensureServerConnected,
  makeMcpClient,
  BarndoorSDK,
  getDynamicConfig,
  getStaticConfig,
  hasOrganizationInfo,
} from '../dist/index.esm.js';

// simple input helper
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
async function ask(q) {
  return (await rl.question(q)).trim();
}

async function main() {
  try {
    console.log('\n🚀 Starting Universal MCP Client Example...\n');

    // ---------------------------------------------------------------------
    // 1. Authenticate to Barndoor
    // ---------------------------------------------------------------------
    console.log('🔐 Authenticating with Barndoor...');
    let sdk;
    const envToken = process.env.BARNDOOR_ACCESS_TOKEN;

    if (envToken) {
      console.log('🔑 Using token from BARNDOOR_ACCESS_TOKEN');
      const cfg = hasOrganizationInfo(envToken)
        ? getDynamicConfig(envToken)
        : getStaticConfig();
      sdk = new BarndoorSDK(cfg.apiBaseUrl, { token: envToken });
      await sdk.listServers();
      console.log('✅ Authentication successful (env token)!');
    } else {
      sdk = await loginInteractive();
      await sdk.listServers();
      console.log('✅ Authentication successful!');
    }

    // ---------------------------------------------------------------------
    // 2. List all available servers
    // ---------------------------------------------------------------------
    const servers = await sdk.listServers();
    if (!servers.length) throw new Error('No MCP servers found for this user.');
    console.log('\n📡 Available MCP servers:');
    servers.forEach((s, i) => console.log(`  ${i + 1}. ${s.slug} (${s.connection_status})`));

    // Ask user which one to use
    let idx = await ask('\n👉 Enter the number of the server you want to use: ');
    const choice = servers[parseInt(idx) - 1];
    if (!choice) throw new Error('Invalid selection.');
    const SERVER_SLUG = choice.slug;
    console.log(`\n🔗 Selected: ${SERVER_SLUG}\n`);

    // ---------------------------------------------------------------------
    // 3. Ensure it’s connected
    // ---------------------------------------------------------------------
    await ensureServerConnected(sdk, SERVER_SLUG);
    console.log(`✅ ${SERVER_SLUG} connected.`);

    // ---------------------------------------------------------------------
    // 4. Build MCP client and show available tools
    // ---------------------------------------------------------------------
    const mcpClient = await makeMcpClient(sdk, SERVER_SLUG);
    console.log('\n🔧 Fetching available tools...');
    const { tools = [] } = await mcpClient.listTools();
    if (!tools.length) console.log('⚠️  No tools found for this server.');
    else tools.forEach((t, i) => console.log(`  ${i + 1}. ${t.name} — ${t.description || 'No description'}`));

    // ---------------------------------------------------------------------
    // 5. Ask user for a custom prompt
    // ---------------------------------------------------------------------
    const prompt = await ask('\n💬 What do you want to ask or do? (describe task): ');
    console.log(`\n🧠 Interpreting prompt: "${prompt}"`);

    // Naive tool selection: try to find one that matches keyword
    const matching = tools.find(t =>
      prompt.toLowerCase().includes(t.name.toLowerCase().split('_')[0])
    );
    const tool = matching || tools[0];
    if (!tool) throw new Error('No tools available to handle this prompt.');

    console.log(`\n⚙️  Using tool: ${tool.name}`);

    // Ask user for optional JSON args
    let args = '{}';
    if (tool.input_schema) {
      args = await ask('🧩 Optional JSON arguments (or Enter for none): ');
      if (!args.trim()) args = '{}';
    }

    // ---------------------------------------------------------------------
    // 6. Call the selected tool
    // ---------------------------------------------------------------------
    console.log('\n🚀 Executing MCP tool...\n');
    const parsedArgs = JSON.parse(args);
    const response = await mcpClient.callTool({
      name: tool.name,
      arguments: parsedArgs,
    });

    // ---------------------------------------------------------------------
    // 7. Pretty-print the result
    // ---------------------------------------------------------------------
    console.log('\n✅ MCP Response:');
    if (response?.content?.[0]?.type === 'text') {
      console.log(response.content[0].text);
    } else {
      console.dir(response, { depth: 4, colors: true });
    }

    // ---------------------------------------------------------------------
    // 8. Clean up
    // ---------------------------------------------------------------------
    await mcpClient.close();
    await sdk.close();
    rl.close();

    console.log('\n✨ Done!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
    rl.close();
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
