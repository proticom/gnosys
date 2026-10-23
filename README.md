<p align="center">
  <img src="docs/logo.svg" alt="Gnosys" width="200">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/gnosys"><img src="https://img.shields.io/npm/v/gnosys.svg" alt="npm version"></a>
  <a href="https://github.com/proticom/gnosys/actions"><img src="https://github.com/proticom/gnosys/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://gnosys.ai"><img src="https://img.shields.io/badge/docs-gnosys.ai-C04C4C" alt="docs"></a>
  <a href="https://gnosys.ai/guide.html"><img src="https://img.shields.io/badge/CLI%20reference-gnosys.ai%2Fguide-555560" alt="user guide"></a>
  <a href="https://github.com/proticom/gnosys/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/gnosys.svg" alt="license"></a>
</p>

<p align="center">
  A <a href="https://proticom.com">Proticom</a> product. &nbsp;·&nbsp; <b><a href="https://gnosys.ai">gnosys.ai</a></b> is the source of truth for docs.
</p>

---

# Gnosys — One Brain. Zero Context Bloat.

**Gnosys gives AI agents persistent memory that survives across sessions, projects, and machines.**

The central brain is a single SQLite database at `~/.gnosys/gnosys.db` with sub-10ms reads — no vector DBs, no black boxes, no external services. Federated search ranks results across project, user, and global scopes. It runs as a CLI and as a full MCP server that drops straight into Claude Code, Claude Desktop (Chat / Cowork / Code), Cursor, Codex, Gemini CLI, Antigravity, Grok Build, or any MCP client. When you want a human-readable view, `gnosys export` regenerates a full Obsidian vault on demand.

## Install

> **Requires Node.js ^22.16.0 || >=24.0.0.** FTS5 requires this floor. Node 23.x is unsupported. SQLite uses built-in `node:sqlite`. No native SQLite dependency or rebuild is needed when switching supported Node versions.

```bash
npm install -g gnosys
gnosys setup          # configures provider, API key, and your IDE/agent
```

> **Optional local embeddings.** Gnosys auto-installs **@huggingface/transformers**. If it cannot install, use an external embedding API. SQLite does not need this package.

## Quick start

```bash
gnosys setup ides                                        # wire MCP into your IDEs (once)
cd your-project
gnosys init                                              # register the project
gnosys add "We chose PostgreSQL over MySQL for JSON support"
gnosys recall "database selection"                       # what's relevant right now
```

That's the 60-second tour. **Everything else lives on [gnosys.ai](https://gnosys.ai).**

## What you get

- **Central brain** — one `~/.gnosys/gnosys.db` unifies every project (project / user / global scopes). Sub-10ms reads, SQLite as the sole source of truth.
- **Federated search** — tier-boosted hybrid (FTS5 keyword + semantic) search across scopes, with recency and reinforcement.
- **MCP server** — `gnosys serve` exposes 50+ memory tools to any MCP client. Sandbox-first runtime keeps context cost near zero.
- **Web Knowledge Base** — `gnosys web build` turns any site into a searchable index for serverless chatbots, with optional build-time vectors for serverless-safe hybrid semantic search. Zero runtime deps.
- **Dream Mode** — idle-time consolidation: confidence decay, summaries, relationship discovery. Never deletes — only suggests.
- **Multi-machine sync** — share your brain across machines; conflict detection with skip-and-flag resolution.
- **Obsidian export** — `gnosys export` regenerates a full vault with frontmatter, `[[wikilinks]]`, and graph data.

## MCP Tool Reference

All tools are exposed over stdio and HTTP transports. Many tools accept an optional `projectRoot` parameter to target a specific project store.

This package installs two binaries:

- **`gnosys`** — the CLI. `gnosys serve` starts the MCP server (stdio by default, `--transport http` for the central-server topology). `gnosys setup ides` wires `gnosys-mcp` into your IDE/agent configs.
- **`gnosys-mcp`** — a direct alias for the MCP stdio server entry, for MCP clients that prefer to spawn the server binary directly (e.g. `npx -y gnosys-mcp`). Equivalent to `gnosys serve`.

On stdio EOF, the server drains received requests, writes their responses, and
closes resources before exiting 0. Embedding flushes get at most 500 ms or one
third of the shutdown timeout; reindex or an embedding-enabled Dream run recovers
missing vectors. Cleanup errors or the 1500 ms shutdown backstop exit 1.
`GNOSYS_SHUTDOWN_TIMEOUT_MS` accepts plain decimal integers without whitespace
(100–60000 ms). Out-of-range integers and signed infinities warn and clamp to
the nearest bound; other formats warn and use 1500 ms. Both transports exit
130 for SIGINT and 143 for SIGTERM. The first signal during an EOF drain lets
requests finish and sets that exit status. Only a second actual signal forces
immediate resource cleanup and exits with its status. HTTP ignores stdin closure.
On a signal, HTTP rejects new requests and drains admitted POST responses before closing SSE streams.
Synchronous event-loop blocking (for example a long handler or SQLite call) defeats the shutdown bound/backstop; there is no watchdog process.

| Tool | Tier | Description |
|------|------|-------------|
| `gnosys_discover` | standard | Discover relevant memories by describing what you're working on. |
| `gnosys_read` | core | Read a specific memory. |
| `gnosys_search` | standard | Search memories by keyword across all stores. |
| `gnosys_list` | standard | List memories across all stores, optionally filtered by category, tag, or store layer. |
| `gnosys_add_structured` | core | **Preferred for LLM agents.** Add a memory with structured fields you supply (title, category, tags, content) — makes no server-side LLM call. |
| `gnosys_add` | full | Add a memory from raw text; the server's LLM structures it. For non-agent callers (scripts, cron) — agents should use `gnosys_add_structured`. |
| `gnosys_tags` | standard | List all tags in the registry, grouped by category. |
| `gnosys_tags_add` | full | Add a new tag to the registry. |
| `gnosys_reinforce` | core | Signal whether a memory was useful. |
| `gnosys_init` | core | Initialize Gnosys in a project directory. |
| `gnosys_migrate` | full | Migrate a Gnosys store (.gnosys/) from one directory to another. |
| `gnosys_update` | core | Update an existing memory's frontmatter and/or content. |
| `gnosys_stale` | full | Find memories that haven't been modified or reviewed within a given number of days. |
| `gnosys_commit_context` | full | Pre-compaction memory sweep. |
| `gnosys_history` | full | View audit history for a memory. |
| `gnosys_lens` | standard | Filtered view of memories. |
| `gnosys_timeline` | standard | View memory creation and modification activity over time. |
| `gnosys_stats` | standard | Summary statistics across all memories — totals by category, status, author, authority, average confidence, and date ranges. |
| `gnosys_links` | standard | Show wikilinks for a specific memory — outgoing [[links]] and backlinks from other memories. |
| `gnosys_graph` | standard | Show the full cross-reference graph across all memories. |
| `gnosys_bootstrap` | full | Batch-import existing documents from a directory into the memory store. |
| `gnosys_import` | full | Bulk import structured data (CSV, JSON, JSONL) into Gnosys memories. |
| `gnosys_hybrid_search` | core | Main search: keyword, semantic, or hybrid ranking with snippets and IDs. |
| `gnosys_semantic_search` | standard | Search memories using semantic similarity only (no keyword matching). |
| `gnosys_reindex` | full | Rebuild all semantic embeddings from every memory file. |
| `gnosys_ask` | standard | Ask a natural-language question and get a synthesized answer with citations from the entire vault. |
| `gnosys_maintain` | full | Run vault maintenance: detect duplicate memories, apply confidence decay, consolidate similar memories. |
| `gnosys_dearchive` | full | Force-dearchive memories from archive.db back to active. |
| `gnosys_reindex_graph` | full | Build or rebuild the wikilink graph (.gnosys/graph.json). |
| `gnosys_dream` | full | Run a Dream Mode cycle — idle-time consolidation that decays confidence, generates category summaries, discovers relationships, and creates review suggestions. |
| `gnosys_export` | full | Export gnosys.db to Obsidian-compatible vault — atomic Markdown files with YAML frontmatter, [[wikilinks]], category summaries, and relationship graph. |
| `gnosys_dashboard` | core | Show the Gnosys system dashboard: memory counts, maintenance health, graph stats, LLM provider status. |
| `gnosys_stores` | full | Debug tool — lists all detected Gnosys stores across registered projects, MCP workspace roots, cwd, and environment variables. |
| `gnosys_recall` | core | Fast memory recall — inject relevant memories as context. |
| `gnosys_audit` | full | View the audit trail of all memory operations (reads, writes, reinforcements, dearchives, maintenance). |
| `gnosys_preference_set` | core | Set a user preference. |
| `gnosys_preference_get` | core | Get a user preference by key, or list all preferences. |
| `gnosys_preference_delete` | standard | Delete a user preference by key. |
| `gnosys_sync` | full | Get the current user preferences + project conventions formatted as a GNOSYS:START/GNOSYS:END block. |
| `gnosys_federated_search` | standard | Search across scopes with boosts, memory IDs, status labels, and replacements before history. |
| `gnosys_detect_ambiguity` | full | Check if a query matches memories in multiple projects. |
| `gnosys_briefing` | core | Generate a project briefing — a summary of memory state, categories, recent activity, and top tags. |
| `gnosys_portfolio` | full | Portfolio dashboard — shows all registered projects with memory counts, categories, status snapshots, roadmap items, and recent activity. |
| `gnosys_remote_status` | full | Check the status of remote sync (multi-machine). |
| `gnosys_remote_push` | full | Push local memory changes to the remote (NAS) database. |
| `gnosys_remote_pull` | full | Pull remote memory changes to the local database. |
| `gnosys_remote_resolve` | full | Resolve a sync conflict by choosing which version to keep. |
| `gnosys_update_status` | standard | Get the prompt/template for writing a dashboard-compatible status memory for this project. |
| `gnosys_working_set` | standard | Get the implicit working set — recently modified memories for the current project. |
| `gnosys_ingest_file` | standard | Ingest a file (PDF, DOCX, TXT, MD, images via vision LLM, audio/video via Whisper transcription) into Gnosys memory. |
| `gnosys_attach` | standard | Attach a small binary file (logo, diagram, screenshot, small PDF) inline to a memory (~10MB limit; syncs machine-to-machine). |
| `gnosys_get_attachment` | standard | Retrieve the binary attachment stored on a memory (base64 bytes, or write to disk via outputPath). |
| `gnosys_trace` | standard | Trace a codebase directory and store procedural "how" memories with call-chain relationships. |
| `gnosys_reflect` | core | Record a real-world outcome against related memories, adjusting their confidence and linking them. |
| `gnosys_traverse` | core | Walk relationship chains from a memory id (BFS, depth-limited), optionally filtered by direction or relationship types. |
| `gnosys_toolset` | core | Inspect the tool catalog or switch the active tier. |

### Toolset tiers

Tool descriptions and schemas consume agent context, so since v6.2.0 every session **starts on the `core` tier** and agents self-escalate in-session: calling `gnosys_toolset` without arguments lists what the higher tiers add, and `gnosys_toolset {"set": "standard"|"full"}` enables them at runtime (and `"core"` shrinks back). The switch emits `notifications/tools/list_changed`, so MCP clients pick up the new tools automatically.

| Tier | Tools | Contents |
|------|-------|----------------------|
| `core` (default) | 14 | Main memory workflow, hybrid search, reflection, traversal, and tier switching |
| `standard` | 33 | Core plus specialist search, tracing, browsing, attachments, and ingestion |
| `full` | 56 | All tools, including freeform ingestion, maintenance, remote sync, and export |

`GNOSYS_MCP_TOOLSET=core|standard|full` overrides the starting tier (unknown values warn on stderr and fall back to `core`). The starting toolset and escalation hint are announced in the MCP server instructions. See [docs/mcp-toolsets.md](./docs/mcp-toolsets.md).

## Documentation

| | |
|---|---|
| **Full docs & guides** | <https://gnosys.ai> |
| **Complete CLI + MCP reference** | <https://gnosys.ai/guide.html> |
| **Changelog** | [CHANGELOG.md](./CHANGELOG.md) |
| **Contributing** | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| **Security policy** | [SECURITY.md](./SECURITY.md) |
| **Report a bug / request a feature** | [GitHub Issues](https://github.com/proticom/gnosys/issues) |

## License

MIT © [Proticom](https://proticom.com). See [LICENSE](./LICENSE).
