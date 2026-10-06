# gnosys update

Update an existing memory's frontmatter and/or content.

## Usage

```bash
gnosys update mem-001 --title "New title"
gnosys update project:decisions/auth.md --status superseded --superseded-by mem-002
gnosys update mem-002 --content "Replacement body"
```

## Arguments

| Argument | Description |
|----------|-------------|
| `memoryPath` | Memory path or ID to update |

## Options

| Option | Description |
|--------|-------------|
| `--title <title>` | New title |
| `--status <status>` | New status (for example `active`, `archived`, `superseded`, `completed`) |
| `--confidence <n>` | New confidence (0–1) |
| `--relevance <keywords>` | Updated relevance keyword cloud |
| `--supersedes <id>` | Comma-separated predecessor IDs to link to this successor |
| `--superseded-by <id>` | ID of memory that supersedes this one |
| `--content <content>` | New markdown content (replaces body) |

## Behavior

1. Opens central DB; exits with `Central DB not available.` if unavailable.
2. DB-first lookup via `getMemory(memoryPath)`.
3. Falls back to `resolver.readMemory(memoryPath)` when not found in DB.
4. Exits with `Memory not found: <memoryPath>` when unresolved.
5. Maps CLI options to update fields (`superseded-by` → `superseded_by`).
6. When `--content` is set, builds full markdown with `# title` header.
7. Writes via `syncUpdateToDb`.
8. Either `--supersedes` or `--superseded-by` validates the target and cross-links both memories atomically. Missing IDs and cycles are rejected. A successor can have many predecessors. Its `supersedes` list is derived from their `superseded_by` links in stable order. All changed rows get a new modified timestamp. Links stay in the same scope and project; MCP `gnosys_update` can opt in with `allowCrossScope: true`.
9. To unlink one predecessor, update it with `--superseded-by ""`. Clearing the derived successor list is rejected while predecessors exist. Other predecessors stay unchanged. An explicit status is preserved; otherwise unlinking restores active or archived status according to tier.
10. Closes DB in `finally`.

## Output

```text
Memory updated: New title
ID: mem-001
Changed: title, content
```

Supersession cross-link:

```text
Cross-linked: old-id marked as superseded.
```

## Validation

```bash
cd gnosys-public
npm run cli -- update --help
```

## Related commands

- `gnosys read` — inspect a memory before updating.
- `gnosys reinforce` — signal usefulness without editing content.
