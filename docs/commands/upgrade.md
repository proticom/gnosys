# gnosys upgrade

Upgrade the Gnosys CLI/MCP package itself and signal running MCP servers to restart.

## Usage

```bash
gnosys upgrade
gnosys upgrade --yes
gnosys upgrade --no-sync
gnosys upgrade --yes --json
```

## Options

| Option | Description |
|--------|-------------|
| `--yes` | Accept the defaults with no prompt: upgrade, then run `gnosys setup sync-projects --yes` (which also removes dead and temp registry entries) |
| `--no-sync` | Upgrade only; skip `setup sync-projects` |
| `--json` | Print one JSON result on stdout; human text goes to stderr. Needs `--yes` or `--no-sync` |

`--yes` changed meaning in this release. It used to skip sync-projects. Use
`--no-sync` for that now.

## Behavior

1. Prints the current CLI version.
2. Detects the package manager via `detectPackageManager()`.
3. Builds and runs the global upgrade command via `upgradeCommand(pm)` using `execSync`.
4. Best-effort reads the newly installed version from `npm ls -g gnosys`.
5. Writes the MCP restart marker via `writeUpgradeMarker()` to `~/.gnosys/last-upgrade-at`.
6. With `--yes`, runs `gnosys setup sync-projects --yes`. With `--no-sync`, stops. Otherwise prompts.

## Without a terminal

When stdin is not a TTY and neither `--yes` nor `--no-sync` is given, the
command exits with code 1 before installing anything:

```text
gnosys upgrade is interactive and requires a terminal (stdin is not a TTY). Pass --yes (upgrade, then sync projects) or --no-sync (upgrade only) to run it without prompts.
```

## JSON output

```json
{
  "ok": true,
  "previousVersion": "6.3.1",
  "installedVersion": "6.4.0",
  "packageManager": "npm",
  "installCommand": "npm install -g gnosys@latest",
  "markerWritten": true,
  "dreamRepair": null,
  "sync": { "ran": true, "result": { "ok": true, "total": 3, "registryCleanup": { "removed": 1, "kept": 2, "wrote": true } } }
}
```

`sync.result` is the `gnosys setup sync-projects --json` document (shortened
here). With `--no-sync` it is `{ "ran": false }`.

## Npx behavior

When running under npx (no global install), the command exits early:

```text
Running under npx — there's no global install to upgrade. Use `npx gnosys@latest` to run the latest.
```

## Post-upgrade sync prompt

Interactive default:

```text
Run 'gnosys setup sync-projects' now to refresh registered projects? [Y/n]
```

If confirmed, shells out to:

```bash
gnosys setup sync-projects
```

With `--yes` the prompt is skipped and sync-projects runs with `--yes`. With `--no-sync` the prompt is skipped and the command reminds you that sync-projects can be run later.

## Side effects

- Upgrades the globally installed `gnosys` npm package (when not running under npx).
- Writes `~/.gnosys/last-upgrade-at` so running MCP servers restart cleanly within ~10 seconds.

## Errors

Upgrade command failure exits with code 1 and suggests running the upgrade command manually.

Sync-projects subprocess failure exits with code 1 and suggests running sync manually.

## Validation

```bash
cd gnosys-public
npm run cli -- upgrade --help
npx vitest run src/test/unattended-maintenance.test.ts
```

## Related commands

- `gnosys setup sync-projects` — refresh registered projects after upgrading.
- `gnosys doctor` — verify stores, LLM connectivity, and embeddings.
