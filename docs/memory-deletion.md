# Memory deletion needs a human

Agents may run any gnosys command except one that deletes memories. Gnosys
enforces this itself, so it holds for every agent (Claude Code, Cursor, Codex,
a Grok bot) and not only for agents that run a local hook.

## The rule

A memory row is deleted only when one of these is true:

1. A human at an interactive terminal types the confirmation text: the
   preference key, the memory id, the project id, or the backup file name.
2. A human sets `GNOSYS_ALLOW_MEMORY_DELETE=1` in the environment of that one
   command.

Agent surfaces always refuse, whatever the environment says:

- the MCP server (`gnosys serve`, `gnosys-mcp`, the HTTP runtime)
- the sandbox socket server (`gnosys sandbox start`)

The refusal names the alternative: mark the memory `superseded` or `archived`
with `gnosys update <id> --status superseded|archived` or the MCP tool
`gnosys_update`. Superseded and archived memories stay in the database as
history. Recall and auto-context skip them.

## `GNOSYS_ALLOW_MEMORY_DELETE`

Set it by a human, never by an agent. Use it for scripts a human runs and
reviews, for example a migration on a fresh machine. Set it on the command
line for one command:

```bash
GNOSYS_ALLOW_MEMORY_DELETE=1 gnosys pref delete old-key
```

Gnosys does not read this variable from `.env` files (`~/.config/gnosys/.env`
or `./.env`), because an agent can write those files. The MCP server and the
sandbox server ignore it.

## Where the check lives

Every deletion path ends at `GnosysDB.deleteMemory` or `GnosysDB.restore`.
Both call `assertMemoryDeletionAllowed` in `src/lib/memoryDeleteGuard.ts`.
Commands that can prompt call `confirmMemoryDeletion` first; it asks for the
typed confirmation and grants a one-shot permission for the exact rows it
named. A path that skips the prompt is refused at the boundary.

| Path | Confirmation text |
|------|-------------------|
| `gnosys pref delete <key>` | the key |
| `gnosys setup preferences`, then Delete | the key |
| `gnosys import project <bundle> --strategy replace` | the project id |
| `gnosys restore <backup>` (when a live DB exists) | the backup file name |
| MCP `gnosys_preference_delete` | always refused |
| sandbox `pref_delete` | always refused |

## Restore takes a safety backup

`gnosys restore` replaces the whole database, so it deletes every memory that
is not in the backup. After the confirmation, and before the copy, it writes
`gnosys-pre-restore-<timestamp>.db` next to the live database. The JSON
output reports the path as `preRestoreBackup`. If the live database is
corrupt and cannot be opened, the raw `gnosys.db`, `-wal` and `-shm` files are
copied instead.

## Commands that never delete

Dream, `gnosys maintain` (including `--auto-apply`) and supersession only flag,
archive or link memories. Maintenance only removes a legacy per-store
`gnosys.db` file with `gnosys doctor --fix` when every row in it is already in
the central database.
