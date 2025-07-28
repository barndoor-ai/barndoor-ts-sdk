# Barndoor JavaScript SDK

A lightweight, **framework-agnostic** JavaScript client for the Barndoor Platform REST APIs and Model Context Protocol (MCP) servers.

The SDK removes boiler-plate around:

* Secure, offline-friendly **authentication to Barndoor** (interactive PKCE flow + token caching).
* **Server registry** – list, inspect and connect third-party providers (Salesforce, Notion, Slack …).
* **Managed Connector Proxy** – build ready-to-use connection parameters for any LLM/agent framework (CrewAI, LangChain, custom code …) without importing Barndoor-specific adapters.

## Installation

```bash
npm install @barndoor/sdk
```

## Quick Start

### Basic Usage

```javascript
import { BarndoorSDK } from '@barndoor/sdk';

// Initialize with your API base URL and token
const sdk = new BarndoorSDK('https://your-org.mcp.barndoor.ai', {
  token: 'your-jwt-token'
});

// List available MCP servers
const servers = await sdk.listServers();
console.log('Available servers:', servers);

// Get details for a specific server
const server = await sdk.getServer('server-uuid');
console.log('Server details:', server);

// Clean up
await sdk.close();
```

### Interactive Login

For development and prototyping, use the interactive login helper:

```javascript
import { loginInteractive } from '@barndoor/sdk';

// Automatically handles OAuth flow and token caching
const sdk = await loginInteractive();
const servers = await sdk.listServers();
```

### Complete Workflow

```javascript
import { 
  loginInteractive, 
  ensureServerConnected, 
  makeMcpConnectionParams 
} from '@barndoor/sdk';

async function main() {
  // 1. Login (handles OAuth + caching)
  const sdk = await loginInteractive();
  
  // 2. Ensure server is connected (launches OAuth if needed)
  await ensureServerConnected(sdk, 'notion');
  
  // 3. Get connection parameters for your AI framework
  const [params, publicUrl] = await makeMcpConnectionParams(sdk, 'notion');
  
  // 4. Use with any MCP-compatible framework
  console.log('MCP URL:', params.url);
  console.log('Headers:', params.headers);
  
  await sdk.close();
}
```

## Environment Configuration

The SDK automatically detects your environment and configures appropriate endpoints:

```bash
# Development
export MODE=development
export AGENT_CLIENT_ID=your_client_id
export AGENT_CLIENT_SECRET=your_client_secret

# Production  
export MODE=production
export AGENT_CLIENT_ID=your_client_id
export AGENT_CLIENT_SECRET=your_client_secret

# Local development
export MODE=localdev
export BARNDOOR_API=http://localhost:8000
export BARNDOOR_URL=http://localhost:8000
```

## API Reference

### BarndoorSDK

Main SDK class for API interactions.

```javascript
const sdk = new BarndoorSDK(apiBaseUrl, options);
```

**Parameters:**
- `apiBaseUrl` (string): Base URL of the Barndoor API
- `options.token` (string): User JWT token
- `options.timeout` (number): Request timeout in seconds (default: 30)
- `options.maxRetries` (number): Maximum retry attempts (default: 3)

**Methods:**

#### `listServers()`
List all MCP servers available to your organization.

```javascript
const servers = await sdk.listServers();
// Returns: ServerSummary[]
```

#### `getServer(serverId)`
Get detailed information about a specific server.

```javascript
const server = await sdk.getServer('server-uuid');
// Returns: ServerDetail
```

#### `initiateConnection(serverId, returnUrl?)`
Initiate OAuth connection flow for a server.

```javascript
const connection = await sdk.initiateConnection('server-uuid');
// Returns: { connection_id, auth_url, state }
```

#### `getConnectionStatus(serverId)`
Get connection status for a server.

```javascript
const status = await sdk.getConnectionStatus('server-uuid');
// Returns: 'available' | 'pending' | 'connected'
```

### Quick-start Helpers

#### `loginInteractive(options?)`
Perform interactive OAuth login and return initialized SDK.

```javascript
const sdk = await loginInteractive({
  authDomain: 'auth.barndoor.ai',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  port: 52765
});
```

#### `ensureServerConnected(sdk, serverSlug, options?)`
Ensure a server is connected, launching OAuth if needed.

```javascript
await ensureServerConnected(sdk, 'notion', { timeout: 90 });
```

#### `makeMcpConnectionParams(sdk, serverSlug, options?)`
Generate MCP connection parameters for AI frameworks.

```javascript
const [params, publicUrl] = await makeMcpConnectionParams(sdk, 'notion');
// params: { url, transport, headers }
```

## Error Handling

The SDK provides a comprehensive error hierarchy:

```javascript
import { 
  BarndoorError,
  HTTPError,
  ConnectionError,
  TokenError,
  ConfigurationError 
} from '@barndoor/sdk';

try {
  await sdk.listServers();
} catch (error) {
  if (error instanceof HTTPError) {
    console.error('HTTP Error:', error.statusCode, error.message);
  } else if (error instanceof TokenError) {
    console.error('Token Error:', error.message);
    // Re-authenticate
  } else if (error instanceof ConnectionError) {
    console.error('Connection Error:', error.message);
    // Check network
  }
}
```

## Browser Support

The SDK works in both Node.js and browser environments:

```javascript
// Browser usage
import { BarndoorSDK } from '@barndoor/sdk';

// Token storage uses localStorage in browsers
const sdk = new BarndoorSDK('https://api.barndoor.ai', {
  token: 'your-token'
});
```

**Note:** Interactive login (`loginInteractive`) requires Node.js for the local callback server.

## Examples

See the `examples/` directory for complete working examples:

- `openai-integration.js` - OpenAI + MCP function calling integration
- `basic-mcp-client.js` - Direct MCP client without AI framework

## TypeScript Support

The SDK includes TypeScript definitions:

```typescript
import { BarndoorSDK, ServerSummary } from '@barndoor/sdk';

const sdk = new BarndoorSDK('https://api.barndoor.ai', {
  token: 'your-token'
});

const servers: ServerSummary[] = await sdk.listServers();
```

## Contributing

1. Clone the repository
2. Install dependencies: `npm install`
3. Run tests: `npm test`
4. Run safety checks: `npm run safety-check`


