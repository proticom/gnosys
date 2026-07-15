# MCP Toolset Tiers

Every MCP tool definition (name, description, JSON schema) is injected into the calling agent's
context window on every session. With all Gnosys tools active, the `tools/list` payload is
roughly **41k characters (~10k tokens)** — paid before the agent does any work.

Since v6.2.0 the server **starts every session on the `core` tier** and lets agents
self-escalate (or shrink back) at runtime via the always-available `gnosys_toolset` tool.
All tools are registered on every server; tiers only control which tools are *enabled*.

| Tier | Tools | Serialized payload | Approx. tokens |
|------|-------|--------------------|----------------|
| `core` (default) | 19 | ~15k chars | ~3.7k |
| `standard` | 34 | ~25k chars | ~6.3k |
| `full` | 56 | ~41k chars | ~10.2k |

## In-session self-escalation (v6.2)

- `gnosys_toolset` (no arguments) — returns the active tier plus a compact catalog of the
  tools each higher tier adds (name + one-line purpose), so the agent can decide whether to
  expand.
- `gnosys_toolset { "set": "standard" | "full" | "core" }` — switches tiers up **or** down.
  The server enables/disables the delta and emits `notifications/tools/list_changed`, so
  MCP clients refresh their tool list automatically.
- `gnosys_toolset` itself is part of the core tier and is never disabled.
- In HTTP mode each session has its own `McpServer` instance, so tier switches are
  per-session and never leak across agents.

## Tier contents

- **core** — the proven Apple "Core 15" surface plus the v6.1 process-trace tools and the
  v6.2 tier switcher:
  `gnosys_init`, `gnosys_add_structured`, `gnosys_add`, `gnosys_read`, `gnosys_update`,
  `gnosys_discover`, `gnosys_recall`, `gnosys_search`, `gnosys_hybrid_search`,
  `gnosys_federated_search`, `gnosys_reinforce`, `gnosys_preference_set`,
  `gnosys_preference_get`, `gnosys_briefing`, `gnosys_dashboard`,
  `gnosys_trace`, `gnosys_reflect`, `gnosys_traverse`, `gnosys_toolset`.
- **standard** — core plus: `gnosys_list`, `gnosys_stats`, `gnosys_tags`, `gnosys_timeline`,
  `gnosys_working_set`, `gnosys_semantic_search`, `gnosys_ask`, `gnosys_lens`, `gnosys_links`,
  `gnosys_graph`, `gnosys_attach`, `gnosys_get_attachment`, `gnosys_ingest_file`,
  `gnosys_update_status`, `gnosys_preference_delete`.
- **full** — everything, including maintenance, import/export, remote sync, and debug tools.

## Environment override

`GNOSYS_MCP_TOOLSET=core|standard|full` sets the *starting* tier for new sessions
(agents can still switch afterwards with `gnosys_toolset`). Unknown values print a
warning on stderr and fall back to `core`. The active starting tier and the
self-escalation hint are announced in the server `instructions` returned in the MCP
`initialize` response.

```json
{
  "mcpServers": {
    "gnosys": {
      "command": "npx",
      "args": ["-y", "gnosys-mcp"],
      "env": { "GNOSYS_MCP_TOOLSET": "full" }
    }
  }
}
```
