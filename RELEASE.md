# Release: v2.0.0

**Tag:** `v2.0.0`

**Title:** v2.0.0 — Agent-First SQLite Core + Dream Mode + Multi-Project Support

**Release Notes:**

## What's New in v2.0

### Agent-First SQLite Core
- Unified `gnosys.db` replaces four separate data stores (`.md` files, `archive.db`, `embeddings.db`, `graph.json`)
- 5-table schema: `memories`, `memories_fts` (FTS5), `relationships`, `summaries`, `audit_log`
- All reads go through SQLite for sub-10ms performance
- Dual-write keeps `.md` files in sync as a human-readable safety net
- `gnosys migrate` — one-shot migration from v1.x stores
- WAL mode for safe concurrent access from multiple processes

### Dream Mode — Idle-Time Consolidation
- 4-phase cycle: confidence decay, self-critique, summary generation, relationship discovery
- Never deletes autonomously — only suggests reviews
- Configurable idle timer with automatic abort on agent activity
- Off by default; enable in `gnosys.json` under `dream`
- `gnosys dream` CLI command + `gnosys_dream` MCP tool

### Obsidian Export Bridge
- One-way export from `gnosys.db` to Obsidian-compatible vault
- Outputs: YAML frontmatter `.md` files, `[[wikilinks]]`, `_summaries/`, `_review/`, `_graph/`
- `gnosys export --to <dir>` CLI command + `gnosys_export` MCP tool

### Multi-Project / Multi-Root Workspace Support
- Every MCP tool accepts optional `projectRoot` for stateless per-call routing
- MCP roots protocol: `roots/list` on connect + `roots/list_changed` notifications
- Zero race conditions when parallel agents write to different projects
- `gnosys_stores` enhanced with MCP roots and detected store debugging info

### New MCP Tools
- `gnosys_dream` — Run a Dream Mode consolidation cycle
- `gnosys_export` — Export to Obsidian vault
- Total: 35 MCP tools + `gnosys://recall` resource

### New CLI Commands
- `gnosys migrate` — Migrate v1.x data to unified `gnosys.db`
- `gnosys dream` — Run Dream Mode with `--max-runtime`, `--no-critique`, `--no-summaries`, `--no-relationships`, `--json`
- `gnosys export` — Export to Obsidian with `--to`, `--all`, `--overwrite`, `--no-summaries`, `--no-reviews`, `--no-graph`, `--json`

### Infrastructure
- Version bumped to 2.0.0
- 143 tests passing, zero TypeScript errors
- `GnosysResolver` extended with `resolveForProject()` factory and `detectAllStores()`
- Dream config added to `gnosys.json` schema with Zod validation

---

# Previous Releases

## v1.4.0 — Aggressive Recall as MCP Resource
- Recall config simplified to single `aggressive: boolean` toggle
- `gnosys://recall` MCP Resource as primary injection mechanism
- Host-friendly format for automatic memory injection

## v1.3.0 — Enterprise Reliability
- Recall hook: sub-50ms memory retrieval for agent orchestrators
- Concurrency safety: file locking with PID tracking, WAL mode
- Structured JSONL audit logging with traceId support
- Deterministic dearchive with three-stage fallback
- Performance monitoring in dashboard

## v1.2.0 — Two-Tier Memory
- Active layer (`.md` files) + Archive layer (`archive.db`)
- Auto-archive stale memories, auto-dearchive on cite
- Bidirectional flow: maintain → archive, search/ask → dearchive

## v1.1.0 — Final Polish & Growth
- System of Cognition: 5 LLM providers (Anthropic, Ollama, Groq, OpenAI, LM Studio)
- `gnosys dashboard` — aggregated system status
- Persistent wikilink graph (`graph.json`)

## v1.0.0 — Auto Memory Maintenance
- Maintenance engine: confidence decay, duplicate detection, LLM consolidation
- Automatic reinforcement in search/ask tools
- `gnosys maintain` with dry-run and auto-apply

## v0.6.0 — Simplified Local LLM Layer
- LLM provider abstraction with factory pattern
- Anthropic + Ollama providers
- Task-based model routing
- `gnosys config` and `gnosys doctor` commands

## v0.5.0 — Hybrid Search + Freeform Ask
- Semantic embeddings (all-MiniLM-L6-v2)
- Hybrid search with RRF fusion
- Freeform Q&A with LLM synthesis and wikilink citations

## v0.4.0 — Real-World Demos + Production Infrastructure
- USDA FoodData Central + NVD CVE imports
- `gnosys.json` config with Zod validation
- Docker support, GitHub Actions CI
- LLM retry with exponential backoff

## v0.2.0 — Multi-client support & npm polish
- Setup instructions for Codex and OpenCode
- Tabbed config selector on landing page
- npm package improvements, SEO, CI/CD
