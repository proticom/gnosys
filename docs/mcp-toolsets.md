# MCP Toolset Tiers

Every MCP tool definition (name, description, JSON schema) is injected into the calling agent's
context window on every session. With all 55 Gnosys tools registered, the `tools/list` payload is
roughly **40k characters (~10k tokens)** — paid before the agent does any work.

Since v6.1.0 the server supports **toolset tiers** via the `GNOSYS_MCP_TOOLSET` environment
variable:

| Value | Tools | Serialized payload | Approx. tokens |
|-------|-------|--------------------|----------------|
| `core` | 18 | ~14.5k chars | ~3.6k |
| `standard` | 33 | ~25k chars | ~6.2k |
| `full` (default) | 55 | ~40k chars | ~10k |

## Tier contents

- **core** — the proven Apple "Core 15" surface plus the v6.1 process-trace tools:
  `gnosys_init`, `gnosys_add_structured`, `gnosys_add`, `gnosys_read`, `gnosys_update`,
  `gnosys_discover`, `gnosys_recall`, `gnosys_search`, `gnosys_hybrid_search`,
  `gnosys_federated_search`, `gnosys_reinforce`, `gnosys_preference_set`,
  `gnosys_preference_get`, `gnosys_briefing`, `gnosys_dashboard`,
  `gnosys_trace`, `gnosys_reflect`, `gnosys_traverse`.
- **standard** — core plus: `gnosys_list`, `gnosys_stats`, `gnosys_tags`, `gnosys_timeline`,
  `gnosys_working_set`, `gnosys_semantic_search`, `gnosys_ask`, `gnosys_lens`, `gnosys_links`,
  `gnosys_graph`, `gnosys_attach`, `gnosys_get_attachment`, `gnosys_ingest_file`,
  `gnosys_update_status`, `gnosys_preference_delete`.
- **full** — everything, including maintenance, import/export, remote sync, and debug tools.

## Behavior

- Unknown values print a warning on stderr and fall back to `full`.
- The active toolset is mentioned in the server `instructions` returned in the MCP
  `initialize` response, so agents know when tools are hidden.
- Set the variable in your MCP client config, e.g.:

```json
{
  "mcpServers": {
    "gnosys": {
      "command": "npx",
      "args": ["-y", "gnosys-mcp"],
      "env": { "GNOSYS_MCP_TOOLSET": "core" }
    }
  }
}
```
