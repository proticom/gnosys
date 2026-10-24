# MCP Toolset Tiers

Every MCP tool definition includes a name, description, JSON schema, and four annotation hints.
The enabled definitions are sent to the agent in `tools/list`.

Since v6.2.0 the server **starts every session on the `core` tier** and lets agents
self-escalate (or shrink back) at runtime via the always-available `gnosys_toolset` tool.
All tools are registered on every server; tiers only control which tools are *enabled*.

| Tier | Tools |
|------|-------|
| `core` (default) | 14 |
| `standard` | 33 |
| `full` | 56 |

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

- **core** (14): `gnosys_init`, `gnosys_add_structured`, `gnosys_read`, `gnosys_update`, `gnosys_recall`, `gnosys_hybrid_search`, `gnosys_reinforce`, `gnosys_preference_set`, `gnosys_preference_get`, `gnosys_briefing`, `gnosys_dashboard`, `gnosys_reflect`, `gnosys_traverse`, `gnosys_toolset`.
- **standard** (33): core plus `gnosys_list`, `gnosys_stats`, `gnosys_tags`, `gnosys_timeline`, `gnosys_working_set`, `gnosys_semantic_search`, `gnosys_ask`, `gnosys_lens`, `gnosys_links`, `gnosys_graph`, `gnosys_attach`, `gnosys_get_attachment`, `gnosys_ingest_file`, `gnosys_update_status`, `gnosys_preference_delete`, `gnosys_trace`, `gnosys_search`, `gnosys_federated_search`, `gnosys_discover`.
- **full** (56): everything, including `gnosys_add`, maintenance, import/export, remote sync, and debug tools.

`gnosys_add` moved from core to full. `gnosys_trace`, `gnosys_search`, `gnosys_federated_search`, and `gnosys_discover` moved from core to standard. No tool was renamed or removed. Standard has 33 tools because freeform add moved out of standard as well.

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
      "args": ["-y", "gnosys", "serve"],
      "env": { "GNOSYS_MCP_TOOLSET": "full" }
    }
  }
}
```

## Annotation decisions

[The generated tool table](https://github.com/proticom/gnosys/blob/master/docs/mcp-tools.md) lists all four boolean hints for all 56 tools.
Read-only means no user-visible state changes. Derived search/embedding/graph indexes, local snapshots, and access/audit logs do not count. Incidental NAS cache refresh does not make a local-store tool open-world. Tools that can load an uncached embedding model are open-world because first use can download it from Hugging Face.

Read, keyword search, discover, federated search, and recall do not reinforce memories. Their hints are readOnly=true, destructive=false, idempotent=true, openWorld=false. Graph reindex only rebuilds derived data and has the same hints. Semantic search is also open-world because it can download the embedding model. Explicit embedding reindex is write-capable, non-destructive, idempotent, and open-world. Portfolio returns text and does not write HTML. Preference deletion is refused on the MCP agent surface, so it also has the default hints.

The following tools differ from that default. Additive writes and feedback use destructive=false. Optional file outputs are included in a tool's capability hints. Preference set is an exception to ordinary idempotent upserts: its handler increments reinforcement_count even when the value is unchanged. Update and init also refresh visible modification metadata.

| Tool | Justification |
|------|---------------|
| `gnosys_add` | Calls an LLM to create new memories when operator-enabled. |
| `gnosys_add_structured` | Creates a structured memory and optional predecessor links; serve-mode write-time embeddings can download the model. |
| `gnosys_ask` | Calls an LLM, can download the embedding model, reinforces retrieved memories, and can reactivate archived memories. |
| `gnosys_attach` | Reads a caller-supplied file and replaces an existing different attachment; identical bytes are deduplicated. |
| `gnosys_bootstrap` | Reads caller-supplied documents and can overwrite slug-named memory files. |
| `gnosys_commit_context` | Calls an LLM to extract and structure new memories; repeat model output is not guaranteed identical. |
| `gnosys_dashboard` | Only reads user data, but probes configured Ollama/LM Studio HTTP endpoints. |
| `gnosys_dearchive` | Restores archived memories; missing central rows trigger write-time embeddings and possible model download. Repeated limited queries can restore additional batches. |
| `gnosys_dream` | Calls an LLM and changes confidence, summaries, relationships, and existing memory state. |
| `gnosys_export` | Writes a caller-selected vault and can overwrite files; identical source data produces identical content. |
| `gnosys_get_attachment` | Optional outputPath writes attachment bytes to an arbitrary destination and can overwrite a file. |
| `gnosys_hybrid_search` | Reinforces retrieved memories and can download the embedding model for semantic ranking. |
| `gnosys_import` | Reads a caller-supplied CSV/JSON/JSONL file and creates fresh memory IDs; this MCP path has no overwrite mode. |
| `gnosys_ingest_file` | Reads a caller-supplied file and can call LLM/transcription providers to create new memories. |
| `gnosys_init` | Accepts an arbitrary project directory; re-sync can replace existing identity/IDE files and project metadata. |
| `gnosys_maintain` | Can decay or consolidate existing memories and call an LLM during consolidation. |
| `gnosys_migrate` | Moves caller-selected stores, replaces project registration, and can remove the source directory. |
| `gnosys_preference_set` | Replaces an existing preference and increments reinforcement_count even when the supplied value is unchanged. |
| `gnosys_reflect` | Creates an outcome memory, links evidence, and adjusts confidence; classified as additive feedback. |
| `gnosys_reindex` | Rebuilds derived vectors and can download the embedding model; repeated calls produce the same index without changing user data. |
| `gnosys_reinforce` | Changes reinforcement or review metadata; repeated useful signals increment the count again. |
| `gnosys_remote_pull` | Reads the NAS and can replace local rows; unresolved conflict records receive new detection timestamps on repeats. |
| `gnosys_remote_push` | Writes the NAS and can replace remote rows; unresolved conflict records receive new detection timestamps on repeats. |
| `gnosys_remote_resolve` | Overwrites a local or NAS version and refreshes the selected memory modification timestamp. |
| `gnosys_remote_status` | Reads NAS reachability and sync state without changing user data. |
| `gnosys_semantic_search` | Reads memories without reinforcement and can download the embedding model for query vectors. |
| `gnosys_sync` | Optional commit_to_disk rewrites caller-selected project IDE rules; identical input produces identical blocks. |
| `gnosys_tags_add` | Adds a registry tag; adding an existing tag has no additional effect. |
| `gnosys_toolset` | Changes session tool visibility; selecting the current tier again leaves visibility unchanged. |
| `gnosys_trace` | Reads an arbitrary source directory and creates new procedural memory IDs and relationships on every run. |
| `gnosys_update` | Overwrites existing memory fields/status/links and refreshes modification metadata; searchable-text changes can download the embedding model through the write-time queue. |
