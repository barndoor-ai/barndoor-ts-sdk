# Barndoor TypeScript SDK

A lightweight, **framework-agnostic** TypeScript/JavaScript client for the Barndoor Platform REST APIs and Model Context Protocol (MCP) servers.

The SDK supports *lazy authentication*—you can build an SDK instance first, then inject a JWT later with `authenticate()`.

The SDK removes boiler-plate around:

* Secure, offline-friendly **authentication to Barndoor** (interactive PKCE flow + token caching).
* **Server registry** – list, inspect and connect third-party providers (Salesforce, Notion, Slack …).
* **Managed Connector Proxy** – build ready-to-use connection parameters for any LLM/agent framework (CrewAI, LangChain, custom code …) without importing Barndoor-specific adapters.

## Installation

```bash
npm install @barndoor-ai/sdk
```

## Quick Start

### Basic Usage

```typescript
import { BarndoorSDK } from '@barndoor-ai/sdk';

// ① token known at construction time (unchanged)
const sdk = new BarndoorSDK('https://your-org.mcp.barndoor.ai', {
  token: 'your-jwt'
});
```

```typescript
// ② deferred login (new)
const sdk = new BarndoorSDK('https://your-org.mcp.barndoor.ai');
await sdk.authenticate('your-jwt');

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

`loginInteractive()` builds an SDK *without* requiring `token` in the ctor—it internally calls `sdk.authenticate()` for you.

```typescript
import { loginInteractive } from '@barndoor-ai/sdk';

// Automatically handles OAuth flow and token caching
const sdk = await loginInteractive();
const servers = await sdk.listServers();
```

### Complete Workflow

```typescript
import {
  loginInteractive,
  ensureServerConnected,
  makeMcpConnectionParams
} from '@barndoor-ai/sdk';

async function main() {
  // 1. Login (handles OAuth + caching)
  const sdk = await loginInteractive();

  // 2. Ensure server is connected (launches OAuth if needed)
  await ensureServerConnected(sdk, 'notion'); // sdk.ensureServerConnected(...) is also available directly

  // 3. Get connection parameters for your AI framework
  const [params, publicUrl] = await makeMcpConnectionParams(sdk, 'notion');

  // 4. Use with any MCP-compatible framework
  console.log('MCP URL:', params.url);
  console.log('Headers:', params.headers);

  // 5. Disconnect when done (optional)
  await sdk.disconnectServer('notion');

  await sdk.close();
}
```

### Disconnecting from Servers

To disconnect from a server and clean up OAuth credentials:

```typescript
// Disconnect using server ID or slug
await sdk.disconnectServer('notion');
// or
await sdk.disconnectServer('123e4567-e89b-12d3-a456-426614174000');

// The server will need to be reconnected before use
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

If you run without a token at construction time the SDK will still read `AGENT_CLIENT_ID/SECRET` when `loginInteractive()` is invoked.

## API Reference

### BarndoorSDK

Main SDK class for API interactions.

```javascript
const sdk = new BarndoorSDK(apiBaseUrl, options);
```

**Parameters:**
- `apiBaseUrl` (string): Base URL of the Barndoor API
- `options.token?` (string): Initial JWT (pass later via authenticate() if omitted)
- `options.timeout` (number): Request timeout in seconds (default: 30)
- `options.maxRetries` (number): Maximum retry attempts (default: 3)

**Methods:**

#### `authenticate(jwtToken)`
Sets/validates token for the SDK instance.

```typescript
await sdk.authenticate(jwtToken);
// Returns: Promise<void>
```

#### `ensureServerConnected(serverSlug, options?)`
Ensure a server is connected, launching OAuth if needed – same behaviour as quick-start helper.

```typescript
await sdk.ensureServerConnected('notion', { pollSeconds: 2 });
// Returns: Promise<void>
```

#### `listServers()`
List all MCP servers available to your organization. Automatically fetches all pages if results are paginated.

```typescript
const servers = await sdk.listServers();
// Returns: ServerSummary[]
```

#### `getServer(serverId)`
Get detailed information about a specific server.

```typescript
const server = await sdk.getServer('server-uuid');
// Returns: ServerDetail
```

#### `initiateConnection(serverId, returnUrl?)`
Initiate OAuth connection flow for a server.

```typescript
const connection = await sdk.initiateConnection('server-uuid');
// Returns: { connection_id, auth_url, state }
```

#### `getConnectionStatus(serverId)`
Get connection status for a server.

```typescript
const status = await sdk.getConnectionStatus('server-uuid');
// Returns: 'available' | 'pending' | 'connected'
```

#### `disconnectServer(serverId)`
Disconnect from a specific MCP server.

```typescript
await sdk.disconnectServer('server-uuid');
// Returns: Promise<void>
```

This will remove the connection record and clean up any stored OAuth credentials. The user will need to reconnect to use this server again.

### Quick-start Helpers

#### `loginInteractive(options?)`
Perform interactive OAuth login and return initialized SDK.

```typescript
const sdk = await loginInteractive({
  authDomain: 'auth.barndoor.ai',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  port: 52765
});
```

#### `ensureServerConnected(sdk, serverSlug, options?)`
Ensure a server is connected, launching OAuth if needed.

```typescript
await ensureServerConnected(sdk, 'notion', { timeout: 90 });
```

#### `makeMcpConnectionParams(sdk, serverSlugOrId, options?)`
Generate MCP connection parameters for AI frameworks. Accepts server slug or UUID.

```typescript
// Using slug
const [params, publicUrl] = await makeMcpConnectionParams(sdk, 'notion');

// Using UUID
const [params, publicUrl] = await makeMcpConnectionParams(sdk, '123e4567-...');

// Or via options
const [params, publicUrl] = await makeMcpConnectionParams(sdk, 'notion', {
  serverId: '123e4567-...',  // alternative: pass UUID in options
  serverSlug: 'notion'        // alternative: pass slug in options
});

// params: { url, transport, headers }
```

## Error Handling

The SDK provides a comprehensive error hierarchy:

```typescript
import {
  BarndoorError,
  HTTPError,
  ConnectionError,
  TokenError,
  ConfigurationError
} from '@barndoor-ai/sdk';

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

```typescript
// Browser usage
import { BarndoorSDK } from '@barndoor-ai/sdk';

// Token storage uses localStorage in browsers
const sdk = new BarndoorSDK('https://api.barndoor.ai', {
  token: 'your-token'
});
```

When running in the browser you can also create the SDK first and later call `await sdk.authenticate(token)` once your SPA receives a JWT.

**Note:** Interactive login (`loginInteractive`) requires Node.js for the local callback server.

## Examples

See the `examples/` directory for complete working examples:

- `openai-integration.js` - OpenAI + MCP function calling integration
- `basic-mcp-client.js` - Direct MCP client without AI framework

## TypeScript Support

The SDK is written in TypeScript and includes full type definitions:

```typescript
import { BarndoorSDK, ServerSummary } from '@barndoor-ai/sdk';

const sdk = new BarndoorSDK('https://api.barndoor.ai', {
  token: 'your-token'
});

const servers: ServerSummary[] = await sdk.listServers();
```

## Contributing

1. Clone the repository
2. Install node `nvm install 22 && nvm use 22`
3. Install dependencies: `npm install`
4. Build the project: `npm run build`
5. Run tests: `npm test`
6. Run linting: `npm run lint`
7. Run type checking: `npm run type-check`
