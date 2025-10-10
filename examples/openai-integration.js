/**
 * 🤖 OpenAI Function Calling + Barndoor MCP Integration
 *
 * This script lets the user:
 *  1. Pick an available MCP server (e.g., salesforce, notion, etc)
 *  2. Type a natural-language query (e.g. "list ten notion pages")
 *  3. The model automatically selects the best MCP tool to call
 *  4. The result is returned and summarized in plain English
 *
 * Run with:
 *    node examples/interactive-openai-mcp-client.js
 *
 * Requirements:
 *    npm install openai dotenv readline-sync
 *
 * Make sure `.env` includes:
 *    OPENAI_API_KEY=sk-...
 *    AUTH_DOMAIN=auth.barndoor.ai
 *    AGENT_CLIENT_ID=...
 *    AGENT_CLIENT_SECRET=...
 *    API_AUDIENCE=https://barndoor.ai/
 *    BARNDOOR_URL=https://<your-org>.mcp.barndoor.ai
 */

import 'dotenv/config';
import readlineSync from 'readline-sync';
import { OpenAI } from 'openai';
import {
  loginInteractive,
  ensureServerConnected,
  makeMcpClient,
} from '../dist/index.esm.js';

// --- Step 0: Prepare OpenAI client -------------------------------------------------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

(async () => {
  let sdk;
  let mcpClient;

  try {
    console.log('🚀 Starting Interactive OpenAI + Barndoor MCP Client...\n');

    // ---------------------------------------------------------------------
    // 1️⃣ Authenticate with Barndoor SDK
    // ---------------------------------------------------------------------
    console.log('🔐 Authenticating with Barndoor...');
    sdk = await loginInteractive();

    const servers = await sdk.listServers();
    if (!servers.length) throw new Error('No MCP servers found! Connect at barndoor.ai.');

    console.log('\n🌐 Available MCP servers:');
    servers.forEach((s, i) => console.log(`  ${i + 1}. ${s.slug} (${s.connection_status})`));

    // Prompt user to choose one
    const idx = readlineSync.questionInt(
      '\n👉 Select a server by number: ',
      { limitMessage: 'Enter a valid number!' }
    ) - 1;
    const chosenServer = servers[idx];
    if (!chosenServer) throw new Error('Invalid selection.');

    const SERVER_SLUG = chosenServer.slug;
    console.log(`\n🔗 Ensuring ${SERVER_SLUG} server is connected...`);
    await ensureServerConnected(sdk, SERVER_SLUG);
    console.log(`✅ ${SERVER_SLUG} server connected!\n`);

    mcpClient = await makeMcpClient(sdk, SERVER_SLUG);

    // ---------------------------------------------------------------------
    // 2️⃣ Let user enter a natural language request
    // ---------------------------------------------------------------------
    const userPrompt = readlineSync.question(
      '💬 What do you want to ask or do? (describe task): '
    );

    // ---------------------------------------------------------------------
    // 3️⃣ List available MCP tools and convert to OpenAI function schemas
    // ---------------------------------------------------------------------
    const { tools = [] } = await mcpClient.listTools();
    if (!tools.length) throw new Error(`No tools available on ${SERVER_SLUG}`);

    const functions = tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 64),
        description: t.description || 'MCP tool',
        parameters: t.parameters ?? {
          type: 'object',
          properties: {},
          additionalProperties: true,
        },
      },
    }));

    // ---------------------------------------------------------------------
    // 4️⃣ Use OpenAI to decide which tool to call
    // ---------------------------------------------------------------------
    console.log(`\n🧠 Interpreting prompt: "${userPrompt}"`);
    const msgs = [{ role: 'user', content: userPrompt }];

    let chat = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: msgs,
      tools: functions,
      tool_choice: 'auto',
    });

    let msg = chat.choices[0].message;
    const toolCall = msg.tool_calls?.[0];

    if (!toolCall) {
      console.log('\n🤔 Model did not choose a tool. Here’s its reply:');
      console.log(msg.content);
      return;
    }

    const { name: toolName, arguments: raw } = toolCall.function;
    const args = JSON.parse(raw || '{}');
    console.log(`\n⚙️  Using tool: ${toolName}`);
    console.log('🚀 Executing MCP tool...\n');

    const mcpResult = await mcpClient.callTool({
      name: toolName,
      arguments: args,
    });

    console.log('✅ MCP Response:');
    console.log(JSON.stringify(mcpResult, null, 2));

    // ---------------------------------------------------------------------
    // 5️⃣ Feed MCP result back to OpenAI for a natural summary
    // ---------------------------------------------------------------------
    msgs.push(msg);
    msgs.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      name: toolName,
      content: JSON.stringify(mcpResult),
    });

    chat = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: msgs,
    });

    console.log('\n✨ Final Answer:\n');
    console.log(chat.choices[0].message.content);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
  } finally {
    if (sdk) await sdk.close();
    if (mcpClient) await mcpClient.close();
  }
})();
