/**
 * LangChain MCP Integration Test
 * 
 * This script demonstrates how to use the Barndoor SDK with LangChain's MCP adapters
 * to create AI agents that can interact with Salesforce and Notion data.
 */

import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { PromptTemplate } from '@langchain/core/prompts';
import { 
  loginInteractive, 
  ensureServerConnected, 
  makeMcpConnectionParams 
} from '../src/index.js';

const SERVER_SLUG = 'salesforce'; // or 'notion'

async function main() {
  try {
    console.log('🚀 Starting LangChain MCP Integration Test...\n');

    // ---------------------------------------------------------------------
    // 1. Initialize Barndoor SDK and get MCP connection params
    // ---------------------------------------------------------------------
    console.log('🔐 Authenticating with Barndoor...');
    const sdk = await loginInteractive();
    console.log('✅ Authentication successful!');

    console.log(`\n🔗 Ensuring ${SERVER_SLUG} server is connected...`);
    await ensureServerConnected(sdk, SERVER_SLUG);
    console.log(`✅ ${SERVER_SLUG} server connected!`);

    const [mcpParams, publicUrl] = await makeMcpConnectionParams(sdk, SERVER_SLUG);
    console.log(`📡 MCP URL: ${mcpParams.url}`);

    // ---------------------------------------------------------------------
    // 2. Load MCP tools using LangChain adapter
    // ---------------------------------------------------------------------
    console.log('\n🔧 Initializing LangChain MCP client...');
    const mcpClient = new MultiServerMCPClient({
      servers: {
        [SERVER_SLUG]: {
          url: mcpParams.url,
          headers: {
            ...mcpParams.headers,
            'x-mcp-server-name': SERVER_SLUG
          },
          transport: mcpParams.transport
        }
      }
    });

    await mcpClient.initialize();

    const tools = await mcpClient.listTools(SERVER_SLUG);

    console.log(`📋 Available MCP tools: ${tools.length}`);
    tools.forEach((tool, i) => {
      console.log(`  ${i + 1}. ${tool.name}: ${tool.description}`);
    });

    // ---------------------------------------------------------------------
    // 3. Set up LangChain agent with MCP tools
    // ---------------------------------------------------------------------
    console.log('\n🤖 Creating LangChain agent...');
    
    const llm = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      temperature: 0,
      openAIApiKey: process.env.OPENAI_API_KEY
    });

    const prompt = PromptTemplate.fromTemplate(`
You are a helpful AI assistant that can interact with {server} data through MCP tools.

Available tools: {tools}

Use these tools to help answer the user's question. Always explain what you're doing.

Question: {input}
`);

    const agent = await createOpenAIFunctionsAgent({
      llm,
      tools,
      prompt
    });

    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      verbose: true
    });

    console.log('✅ LangChain agent created!');

    // ---------------------------------------------------------------------
    // 4. Test the agent with real queries
    // ---------------------------------------------------------------------
    console.log('\n🧪 Testing agent with real queries...\n');

    const testQueries = SERVER_SLUG === 'salesforce' ? [
      "List the top 5 accounts by revenue",
      "Show me all opportunities in the 'Proposal' stage",
      "What's the total pipeline value for this quarter?"
    ] : [
      "List all pages in my Notion workspace",
      "Show me the most recently updated pages",
      "What databases do I have access to?"
    ];

    for (const query of testQueries) {
      console.log(`\n🔍 Query: "${query}"`);
      console.log('─'.repeat(50));
      
      try {
        const result = await agentExecutor.invoke({
          input: query,
          server: SERVER_SLUG
        });
        
        console.log('\n📝 Response:');
        console.log(result.output);
      } catch (error) {
        console.error('❌ Error:', error.message);
      }
      
      console.log('\n' + '─'.repeat(50));
    }

    // ---------------------------------------------------------------------
    // 5. Cleanup
    // ---------------------------------------------------------------------
    await sdk.close();
    console.log('\n✅ Test completed successfully!');

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