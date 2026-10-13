# gnosys setup sync-projects

Re-initialize all registered projects after upgrading Gnosys: refresh agent rules, project registry, central DB stamp, and portfolio dashboard.

## Usage

```bash
gnosys setup sync-projects
gnosys setup sync-projects --skip-dashboard
gnosys setup sync-projects --yes --json
```

## Options

| Option | Description |
|--------|-------------|
| `--skip-dashboard` | Skip regenerating the portfolio dashboard files |
| `--yes` | Remove dead and temp registry entries without prompting (same as `gnosys cleanup --yes`) |
| `--json` | Print one JSON result on stdout and nothing else |

## Behavior

1. Reads registered projects from `~/.config/gnosys/projects.json` and merges with central DB project list.
2. Deduplicates by resolved path and writes the merged list back to the file registry.
3. For each local project with `.gnosys/`:
   - Refreshes project identity via `createProjectIdentity`
   - Re-registers in the file-based registry
   - Regenerates agent rules for detected IDEs via `syncToTarget`
   - Configures IDE hooks for automatic memory recall
4. Updates global agent rules.
5. Stamps central DB metadata (app version, last upgrade, machine list).
6. Reports upgraded, skipped, and failed projects.
7. When skipped projects exist: `--yes` removes the stale registry entries; on a terminal (stdin and stdout) without `--yes` it prompts; otherwise it leaves the registry unchanged.
8. Unless `--skip-dashboard`, regenerates portfolio dashboard HTML and Markdown.

## Output

Progress uses the setup sync-projects screen layout with sections for upgraded, skipped, failed, connected machines, and dashboard summary.

## Skipped / failed projects

Projects without `.gnosys/` on disk are skipped. Per-project errors are collected and reported in the failed section without stopping the full sync.

## Cleanup prompt

When skipped entries exist:

- `--yes` removes them without a prompt.
- On a terminal (stdin and stdout are TTYs) without `--yes`, it prompts `remove N entries? [Y/n]`.
- Otherwise (CI, agents, `--json` without `--yes`) the registry is left unchanged and `registryCleanup` is `null`. This is the safe default.

## JSON output

```json
{
  "ok": true,
  "version": "6.3.1",
  "total": 3,
  "upgraded": ["/work/app"],
  "skipped": ["/old/project"],
  "failed": [],
  "tempPruned": 0,
  "globalRules": "updated",
  "registryCleanup": { "removed": 1, "kept": 1, "wrote": true },
  "dashboard": { "html": "/Users/me/gnosys-dashboard.html", "md": "/Users/me/gnosys-dashboard.md" }
}
```

## Dashboard outputs

When dashboard generation succeeds:

- `~/gnosys-dashboard.html`
- `~/gnosys-dashboard.md`

## Errors

No registered projects:

```text
no registered projects found
run `gnosys init` in each project first
```

Individual project failures are reported but do not abort the entire sync.

## Validation

```bash
cd gnosys-public
npm run cli -- setup sync-projects --help
npx vitest run src/test/unattended-maintenance.test.ts
```

## Related commands

- `gnosys upgrade` — upgrade the CLI and optionally suggest running sync-projects afterward.
- `gnosys cleanup` — prune dead registry entries manually.
- `gnosys init` — register a project before it can be synced.
