/**
 * OpenAI Function-Calling + MCP Integration
 *
 * Shows how to let an LLM decide which MCP tool to invoke, run it, and feed the
 * result back to the model – all in ~60 lines.
 *
 * Requirements:
 *   npm install openai dotenv
 *
 * Make sure OPENAI_API_KEY is set in .env.
 */

import 'dotenv/config';
import { OpenAI } from 'openai';
import {
  loginInteractive,
  ensureServerConnected,
  makeMcpClient
} from '../src/index.js';

const SERVER_SLUG = 'salesforce';

// --- Step 0: Prepare OpenAI client -------------------------------------------------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- Main --------------------------------------------------------------------------
(async () => {
  // 1. Authenticate and get MCP params
  const sdk = await loginInteractive();
  await ensureServerConnected(sdk, SERVER_SLUG);
  const mcpClient = await makeMcpClient(sdk, SERVER_SLUG);

  // ---------------------------------------------------------------------
  // List available servers
  // ---------------------------------------------------------------------
  const servers = await sdk.listServers();
  console.log('\nAvailable MCP servers:');
  servers.forEach(s => console.log(`  • ${s.slug.padEnd(12)} status=${s.connection_status}`));

  // Fetch public URL as well for display
  const [params, publicUrl] = await sdk.makeMcpConnectionParams ? await sdk.makeMcpConnectionParams(sdk, SERVER_SLUG) : [null, null];
  if (publicUrl) {
    console.log(`\n✓ Ready – MCP URL: ${params.url}  (public: ${publicUrl})`);
  }

  // 2. Fetch available MCP tools and convert to OpenAI function schemas
  const { tools = [] } = await mcpClient.listTools();

  const functions = tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 64), // ensure valid & short
      description: t.description || 'MCP tool',
      parameters: t.parameters ?? {
        type: 'object',
        properties: {},
        additionalProperties: true
      }
    }
  }));

  // 3. Conversation loop – ask the model, detect a function_call, run it, respond
  const userPrompt = `What are the first 3 Account names in Salesforce?`;
  const msgs = [{ role: 'user', content: userPrompt }];

  // First round: model decides if it wants the function
  let chat = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: msgs,
    tools: functions,
    tool_choice: 'auto'
  });

  let msg = chat.choices[0].message;
  let toolCall = msg.tool_calls?.[0];

  // Handle a single tool call for demo purposes
  if (toolCall) {
    const { name: toolName, arguments: raw } = toolCall.function;
    const args = JSON.parse(raw || '{}');

    const mcpResult = await mcpClient.callTool({
      name: toolName,
      arguments: args
    });

    msgs.push(msg); // add function_call msg
    msgs.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      name: toolName,
      content: JSON.stringify(mcpResult)
    });

    // Second round: give result back to model for final answer
    chat = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: msgs
    });
  }

  console.log('\n💬 Final answer:\n', chat.choices[0].message.content);
  await sdk.close();
  await mcpClient.close();
})();
