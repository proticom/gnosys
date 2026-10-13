# gnosys project merge

Fold a duplicate project into another project. Use it when one project ended up with more than one ID in the central DB.

## Usage

```bash
gnosys project merge <fromId> <intoId>          # dry run
gnosys project merge <fromId> <intoId> --yes    # apply
gnosys project merge <fromId> <intoId> --json
```

## Options

| Option | Description |
|--------|-------------|
| `--yes` | Apply the changes. Takes a SQLite online backup of the central DB first |
| `--json` | Print the plan (and backup path) as JSON |

## What it changes

In one transaction:

- `memories.project_id`: `<fromId>` → `<intoId>`
- `sync_pending_adds.project_id`: `<fromId>` → `<intoId>`
- `project_locations` rows for `<fromId>` are deleted
- the `<fromId>` row in `projects` is deleted

## Safety

- Refuses when `<intoId>` has no row in the central DB, or when the two IDs are the same.
- Dry run by default. `--yes` writes a backup to `~/.gnosys/backups/` first.
- Safe to rerun. A second run finds nothing to move and takes no backup.
- Warns when a registered folder's `.gnosys/gnosys.json` still names `<fromId>`. Running `gnosys init` there would recreate the old row, so point that folder at the kept project first.

## Related commands

- `gnosys project relocate` points a moved project at its new folder.
- `gnosys projects --json` lists project IDs.
