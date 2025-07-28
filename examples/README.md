# Barndoor SDK Examples

This directory contains working examples that demonstrate how to use the Barndoor TypeScript SDK with MCP servers.

## Working Examples

### 1. `openai-integration.js` - OpenAI + MCP Integration
Complete example showing how to integrate OpenAI's function calling with MCP tools.

**What it does:**
- Authenticates with Barndoor
- Connects to an MCP server (Salesforce by default)
- Lets OpenAI decide which MCP tools to call
- Executes the tools and feeds results back to OpenAI

**Requirements:**
```bash
npm install openai dotenv
```

**Environment:**
```bash
export OPENAI_API_KEY="your-openai-api-key"
```

**Run:**
```bash
node examples/openai-integration.js
```

### 2. `basic-mcp-client.js` - Direct MCP Client
Basic example showing direct MCP server interaction without AI frameworks.

**What it does:**
- Authenticates with Barndoor
- Connects to an MCP server
- Lists available tools and resources
- Executes basic operations

**Requirements:**
```bash
npm install dotenv
```

**Run:**
```bash
node examples/basic-mcp-client.js
```

## Configuration

Both examples use the same authentication pattern:

1. **Environment Variables** (create a `.env` file):
   ```
   AUTH_DOMAIN=your-auth-domain
   AGENT_CLIENT_ID=your-client-id
   AGENT_CLIENT_SECRET=your-client-secret
   MODE=development  # or production
   ```

2. **Server Configuration**: Change the `SERVER_SLUG` constant in each file to target different MCP servers:
   - `'salesforce'` - Salesforce integration
   - `'notion'` - Notion integration
   - Or any other configured MCP server

## Key Patterns

Both examples follow the same proven pattern:

```typescript
// 1. Authenticate
const sdk = await loginInteractive();

// 2. Ensure server is connected
await ensureServerConnected(sdk, SERVER_SLUG);

// 3. Create MCP client
const mcpClient = await makeMcpClient(sdk, SERVER_SLUG);

// 4. Use MCP client
const { tools } = await mcpClient.listTools();
const result = await mcpClient.callTool({ name: 'tool_name', arguments: {} });

// 5. Cleanup
await mcpClient.close();
await sdk.close();
```

This pattern uses the `@modelcontextprotocol/sdk` package internally and handles all the complex MCP protocol details for you.

**Note:** While the SDK is written in TypeScript, the current examples are still in JavaScript (.js files) for broader compatibility. You can easily convert them to TypeScript by changing the file extensions to `.ts` and adding type annotations as needed.
