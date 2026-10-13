# gnosys cleanup

Remove dead and temp-dir entries from the project registry (`~/.config/gnosys/projects.json`).

## Usage

```bash
gnosys cleanup
gnosys cleanup --dry-run
gnosys cleanup --yes
gnosys cleanup --dry-run --json
```

## Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Show what would be removed without writing the registry |
| `--yes` | Non-interactive: remove dead/temp entries without prompting |
| `--json` | Print only one JSON result on stdout. Needs `--yes` or `--dry-run` (or `--rules`) |

## Classification

Each registered path is classified as:

| Category | Meaning |
|----------|---------|
| **alive** | Directory exists, contains `.gnosys/`, and no other folder holds the same projectId |
| **moved** | Directory is alive, but another registered folder, or the folder the central DB points at, holds the same projectId |
| **missing** | Directory does not exist (a kind of dead entry) |
| **dead** | Directory exists without `.gnosys/` |
| **temp** | Path under `/tmp`, `/private/tmp`, `/var/folders`, or the OS temp directory |

Only **missing**, **dead**, and **temp** entries are candidates for removal. **Alive** and **moved** entries are always kept. For each moved project, cleanup prints the folders and a `gnosys project relocate <old> <new>` command. `gnosys setup sync-projects` skips moved folders, so it does not write agent files into a stale copy.

Before it writes, cleanup reads and classifies the registry again. It removes only entries that were shown as stale and are still stale, so an edit made while the prompt was open is kept.

## Behavior

### Interactive (default)

```bash
gnosys cleanup
```

Lists alive, dead, and temp entries, then prompts for confirmation before removing dead/temp paths from the registry.

### Dry run

```bash
gnosys cleanup --dry-run
```

Classifies entries and prints JSON with the proposed diff. Does not modify the registry.

### Non-interactive

```bash
gnosys cleanup --yes
```

Removes dead/temp entries immediately and prints JSON with the cleanup result.

## Output

With `--yes` or `--dry-run`, output is JSON including counts of removed and kept entries, and `entries` by category (`alive`, `dead`, `temp`). When some folders share a projectId, `entries` also has `moved` (the registry paths) and `movedGroups` (`projectId`, all `paths`, and the central DB's `dbPath` when it is one of them).

Interactive mode prints a human-readable classification summary before prompting.

With `--json` the result also lists the entries by category:

```json
{ "ok": true, "dryRun": true, "removed": 1, "kept": 0, "wrote": false,
  "entries": { "alive": [], "dead": ["/old/project"], "temp": [] } }
```

## Without a terminal

When stdin is not a TTY and neither `--yes` nor `--dry-run` is given, the
command exits with code 1 and writes nothing:

```text
gnosys cleanup is interactive and requires a terminal (stdin is not a TTY). Pass --yes or --dry-run to run it without prompts.
```

## Safety notes

- Cleanup only edits the **file registry** (`projects.json`). It does not delete project directories or central DB records.
- Run `gnosys setup sync-projects` after cleanup if you want the merged registry rewritten from the central DB.

## Validation

```bash
cd gnosys-public
npm run cli -- cleanup --help
node scripts/audit-commands.mjs --write
```

## Related commands

- `gnosys setup sync-projects` — refresh registry and agent rules after upgrades.
- `gnosys projects` — list registered projects.
- `gnosys project relocate` — point a moved project at its new folder.
- `gnosys init` — register a new project.
