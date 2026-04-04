# AGENTS.md

Instructions for AI agents working in the Gnosys codebase.

## What is Gnosys

Gnosys is an open-source persistent memory system for AI agents. It stores structured memories in a central SQLite database and exposes them via MCP (Model Context Protocol) tools and a CLI. Agents use Gnosys to remember decisions, architecture, project status, and context across sessions.

## Quick Reference

```bash
npm run build          # tsc -> dist/
npm test               # vitest run (718 tests, all should pass)
npx tsc --noEmit       # type check without emitting
```

## Architecture

- **Entry points**: `src/index.ts` (MCP server, 50+ tools), `src/cli.ts` (CLI, 30+ commands)
- **DB-only**: Central SQLite at `~/.gnosys/gnosys.db` is the sole source of truth. No markdown files.
- **Search**: FTS5 keyword -> semantic embeddings -> hybrid RRF -> federated cross-project
- **Web KB**: `gnosys/web` subpath export for serverless chatbots (zero native deps at runtime)
- **Portfolio**: `src/lib/portfolio.ts` + `portfolioHtml.ts` for cross-project status dashboard

## Key Rules

1. **DB-first lookups**: When resolving a memory by ID (e.g. `road-007`), always check `centralDb.getMemory(id)` before falling back to the legacy file resolver.
2. **No markdown writes**: All memory writes go to SQLite only. Markdown is generated on-demand via `gnosys export`.
3. **TypeScript strict**: `strict: true` in tsconfig. Fix all type errors before committing.
4. **Test before commit**: Run `npm test` — all 718 tests must pass. Tests are in `src/test/`.
5. **Path quoting**: The project may live in a path with spaces (iCloud). Always quote paths in shell commands.
6. **Web subpath isolation**: `src/lib/staticSearch.ts` must not import (only `import type`) from modules that depend on `better-sqlite3` or any native addon.

## Memory System

This project uses Gnosys for its own memory. When working here:

- Call `gnosys_discover` at task start to find relevant context
- Write decisions to `gnosys_add_structured` with category `decisions`
- After significant work, run `gnosys update-status` to refresh the project status
- Use `gnosys status` to check current readiness and blockers

## Commit Convention

Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`. Include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>` in commit messages.
