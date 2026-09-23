# @barndoor-ai/sdk

TypeScript client for the [Barndoor AI](https://barndoor.ai) platform API.

```bash
npm install @barndoor-ai/sdk
```

Node 22 or later. Ships ESM and CommonJS builds with type declarations.

## Quick start

```ts
import { createClient } from '@barndoor-ai/sdk';

const client = createClient({ auth: process.env.BARNDOOR_API_KEY! });

const { data } = await client.registry.listMcpServers({});
for (const server of data) {
  console.log(server.name, server.slug);
}
```

`createClient` is synchronous — nothing it does touches the network, so building
a client cannot fail because an identity provider is briefly unreachable. The
first request performs discovery and obtains a token.

## Authentication

`auth` takes one of three things.

**An API key**, or any token you already hold:

```ts
createClient({ auth: 'bdai_…' });
```

**Machine-to-machine credentials**, exchanged and refreshed for you:

```ts
createClient({
  auth: {
    clientId: process.env.BARNDOOR_CLIENT_ID!,
    clientSecret: process.env.BARNDOOR_CLIENT_SECRET!,
  },
});
```

**Your own token provider**, called on every request — for a token you source
from somewhere else, such as a secrets manager or an inbound request:

```ts
createClient({ auth: async () => fetchTokenFromVault() });
```

For a user-facing login there is also an authorization-code flow:
`startAuthorizationCode` and `completeAuthorizationCode`.

## API surface

The client exposes one namespace per service:

| Namespace | Covers |
|---|---|
| `client.registry` | MCP servers, agents, connections, the directory |
| `client.policy` | Policies, rules, impact analysis |
| `client.identity` | Organizations, users, groups, identity providers |
| `client.notification` | Channels, alerts, subscriptions |
| `client.dlp` | Detection rules, findings, redaction |
| `client.llmGateway` | Models, budgets, API keys, usage |
| `client.systemManagement` | Operational endpoints |

The full surface — every operation, parameter and model — is the OpenAPI
specification the client is generated from, published in this repository as
[openapi.yaml](./openapi.yaml). Types for all of it ship with the package, so
your editor is usually the fastest reference.

## Connecting to MCP

The platform serves MCP as well as REST. `createMcpClient` returns a connected
[Model Context Protocol](https://modelcontextprotocol.io) client, authenticated
with the same credentials:

```ts
import { createClient, createMcpClient } from '@barndoor-ai/sdk';

const client = createClient({ auth: process.env.BARNDOOR_API_KEY! });
const mcp = await createMcpClient(client, 'acme');

const { tools } = await mcp.listTools();
```

If you would rather pass connection details to another framework than use the
client directly, `mcpConnectionParams` returns the `url` and `headers` without
opening a connection.

## Reliability

Requests are retried by default, with backoff. Pass `retry` to tune it, or
`retry: false` to turn it off:

```ts
createClient({ auth, retry: { retries: 5, timeoutMs: 30_000 } });
```

The SDK logs nothing. To see requests, add middleware — this is the extension
point for logging, tracing and metrics:

```ts
createClient({
  auth,
  middleware: [{ pre: async (ctx) => { console.log(ctx.init.method, ctx.url); } }],
});
```

## Non-production environments

Production is the default and needs no configuration. For other environments:

```ts
import { createClient, DEV } from '@barndoor-ai/sdk';

const client = createClient({ auth, env: DEV });
```

`environmentFromEnv()` reads the same from `BARNDOOR_ENV`. Credentials inherit
the environment's issuer, so pointing at dev cannot leave you calling dev with a
production token.

## Examples

Runnable examples are in [examples/](./examples).

## Versioning

The version is the version of the **API contract**, so which SDK speaks to which
API needs no lookup table. It is independent of the Barndoor platform's own
release version.

| Part | Changes when |
|---|---|
| MAJOR | the API breaks — an operation removed, a field made required |
| MINOR | the API gains something — a new operation or optional field |
| PATCH | the SDK changes on its own — a fix, a dependency bump |

Versions on the `dev` dist-tag are prereleases built from unreleased platform
work and carry a `-dev.<commit>` suffix. `npm install @barndoor-ai/sdk` gives
you the latest formal release.

## This repository is generated

The client, this README and the examples are generated or maintained in
Barndoor's platform monorepo and pushed here, which is where the package is
published from. **Pull requests against generated files here will be
overwritten.** Open an issue instead, or contact your Barndoor representative.

## License

MIT — see [LICENSE](./LICENSE).
