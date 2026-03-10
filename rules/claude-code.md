# Gnosys Memory System

You have access to a persistent memory system called **Gnosys** via MCP tools. Use it proactively — don't wait for explicit instructions. Memory makes you a better collaborator over time.

## When to Retrieve Memories

**At the start of every task**, call `gnosys_discover` with keywords describing what you're working on. This returns lightweight metadata — then use `gnosys_read` to load the ones that look relevant.

Also retrieve memories when the user says things like:
- "remember when we…", "what did we decide about…", "recall…", "what do you know about…"
- "check your memory", "look that up", "do we have notes on…"
- Any reference to a past conversation, decision, or piece of knowledge

Use `gnosys_search` for keyword search, `gnosys_hybrid_search` for semantic + keyword, or `gnosys_ask` for a natural-language question with a cited answer.

## When to Write Memories

Commit knowledge to Gnosys whenever ANY of these happen:

### Explicit requests
The user says: "remember this", "memorize", "save this", "note this down", "store this", "record this", "commit to memory", "don't forget", or any variation.

### Decisions and preferences
Whenever the user states a decision, preference, or opinion — even casually. Examples: choosing a library, rejecting an approach, setting a convention, expressing how they want something done.

### Specs and plans
When the user provides a spec, plan, feature request, or implementation prompt — commit it BEFORE starting the work.

### Post-task findings
After completing significant work, commit what was learned: gotchas, key findings, things that worked differently than expected.

## How to Write

Use `gnosys_add` for freeform input (the LLM structures it automatically), or `gnosys_add_structured` for precise control:

```
gnosys_add_structured({
  title: "Descriptive title",
  category: "decisions",          // or: architecture, requirements, concepts, roadmap, landscape, open-questions
  content: "Markdown content...",
  tags: '{"domain": ["tag1"], "type": ["tag2"]}',
  relevance: "space separated keywords for discovery",
  author: "human+ai",
  authority: "declared"
})
```

## How to Update

Use `gnosys_update` to modify existing memories when information changes. Set `supersedes` when a new memory replaces an old one.

Use `gnosys_reinforce` to signal whether a retrieved memory was `useful`, `not_relevant`, or `outdated`.

## Available MCP Tools (Quick Reference)

| Tool | Purpose |
|------|---------|
| `gnosys_discover` | Find relevant memories by keyword (metadata only) — call FIRST |
| `gnosys_read` | Load a specific memory's full content |
| `gnosys_search` | Full-text keyword search |
| `gnosys_hybrid_search` | Keyword + semantic search (best results) |
| `gnosys_semantic_search` | Semantic similarity search only |
| `gnosys_ask` | Natural-language Q&A with citations |
| `gnosys_add` | Add memory from freeform text (LLM-structured) |
| `gnosys_add_structured` | Add memory with explicit fields (no LLM) |
| `gnosys_update` | Update an existing memory |
| `gnosys_reinforce` | Signal memory usefulness |
| `gnosys_list` | List all memories (filterable) |
| `gnosys_lens` | Filtered view with multiple criteria |
| `gnosys_tags` | List tag registry |
| `gnosys_tags_add` | Add a new tag |
| `gnosys_commit_context` | Extract + commit novel memories from context |
| `gnosys_stale` | Find memories not updated recently |
| `gnosys_history` | Version history for a memory |
| `gnosys_rollback` | Revert a memory to a prior version |
| `gnosys_timeline` | Show memory creation/modification timeline |
| `gnosys_stats` | Store statistics |
| `gnosys_links` | Show wikilinks for a memory |
| `gnosys_graph` | Full cross-reference graph |
| `gnosys_dashboard` | System health overview |
| `gnosys_stores` | Show active stores and layers |
| `gnosys_maintain` | Run vault maintenance (dedup, decay) |
| `gnosys_init` | Initialize a new store |
| `gnosys_bootstrap` | Batch-import existing documents |
| `gnosys_import` | Bulk import CSV/JSON/JSONL |
| `gnosys_reindex` | Rebuild semantic embeddings |
| `gnosys_reindex_graph` | Rebuild wikilink graph |
