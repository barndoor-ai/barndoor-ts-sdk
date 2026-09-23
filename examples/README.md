# Examples

Runnable against a real Barndoor organization. Each one reads its credentials
from the environment and says which variables it needs.

| File | Shows |
|---|---|
| `list-mcp-servers.ts` | The smallest useful call — authenticate and read |
| `machine-to-machine.ts` | Client-credentials auth, refreshed for you |
| `mcp-client.ts` | Connecting to MCP and listing tools |
| `connection-params.ts` | MCP connection details for another framework |

```bash
npm install @barndoor-ai/sdk
BARNDOOR_API_KEY=bdai_… npx tsx list-mcp-servers.ts
```

These are type-checked against the client on every regeneration, so an API
change that breaks one fails CI rather than reaching you.
