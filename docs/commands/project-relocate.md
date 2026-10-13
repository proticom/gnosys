# gnosys project relocate

Point a moved project at its new folder. Use it after you move a project tree on disk and the old path is still registered.

## Usage

```bash
gnosys project relocate <oldPath> <newPath>          # dry run
gnosys project relocate <oldPath> <newPath> --yes    # apply
gnosys project relocate <oldPath> <newPath> --json
```

## Options

| Option | Description |
|--------|-------------|
| `--yes` | Apply the changes. Takes a SQLite online backup of the central DB first |
| `--json` | Print the plan (and backup path) as JSON |

## What it checks

- `<newPath>/.gnosys/gnosys.json` must exist and hold a `projectId`.
- The old path's `projectId` comes from `<oldPath>/.gnosys/gnosys.json`. If that folder is gone, it comes from the central DB row that points at the old path.
- The two IDs must match. If they differ, the command refuses and suggests `gnosys project merge`.
- The project must have a row in the central DB.

## What it changes

| Change | Detail |
|--------|--------|
| `registry` | `projects.json`: the old path is replaced by the new path. Duplicate paths are removed |
| `location` | Central DB `projects.working_directory` and this machine's location (root-relative path or `project_locations` row) |
| `identity_file` | `workingDirectory` in `<newPath>/.gnosys/gnosys.json` |

The old folder is not deleted.

## Safety

- Dry run by default.
- `--yes` writes a backup to `~/.gnosys/backups/gnosys-backup-<timestamp>.db` before any write.
- Safe to rerun. When nothing needs to change, it writes nothing and takes no backup.

## Related commands

- `gnosys cleanup` lists registry folders that share a projectId (the **moved** category) with the matching relocate command.
- `gnosys project merge` folds one project ID into another.
