# gnosys machine show

Show this machine's local `machine.json` configuration (`machineId`, hostname, roots, remote).

## Usage

```bash
gnosys machine show
gnosys machine show --json
```

## Options

| Option | Description |
|--------|-------------|
| `--json` | Output the machine config object as JSON |

## Behavior

1. Reads `machine.json` via `readMachineConfig()`.
2. If missing, prints the expected path from `getMachineConfigPath()` and suggests `gnosys machine migrate` or `gnosys scan`.
3. Otherwise prints human summary or JSON via `outputResult`.

## Human output

```text
machine.json: /Users/you/.gnosys/machine.json
  machineId: abc123...
  hostname:  my-mac
  roots:     {"dev":"/Users/you/projects"}

## Platform notes

### macOS
- Path: `~/.gnosys/machine.json` (or `$GNOSYS_HOME/machine.json`).
- Never synced (machine-local only for network topologies).
- Launchd jobs for serve or sync read this for machineId/roots.

### Linux
- Same as macOS (`~/.gnosys/machine.json`).
- systemd units use the roots and machineId from here.

### Windows
- Path: `%APPDATA%\gnosys\machine.json` or `%LOCALAPPDATA%\gnosys\machine.json`.
- Credential Manager / env for related keys; machine.json for identity and roots.
- WSL: may see Unix paths; the Windows gnosys binary uses the Windows location.

## Related (network + multi-machine)
- `gnosys machine migrate`, `machine list`, `machine forget` for managing the config.
- `gnosys scan` to (re)populate roots.
- `gnosys centralize` and `connect` for the network-hosted flow that relies on stable per-machine identity.
- `gnosys setup remote` for sync against a central brain.
  remote:    (disabled)
```

When remote is enabled with a path:

```text
  remote:    /Volumes/NAS/gnosys-remote
```

## JSON output

With `--json`, emits the full normalized machine config object.

## Missing config

```text
No machine.json yet (/Users/you/.gnosys/machine.json).
Run 'gnosys machine migrate' (existing setup) or 'gnosys scan' to create it.
```

## Validation

```bash
cd gnosys-public
npm run cli -- machine show --help
npx vitest run src/test/machine-command-handler.test.ts
node scripts/audit-commands.mjs --write
```

## Related commands

- [`gnosys machine`](machine.md) — parent command overview
- `gnosys machine migrate` — create `machine.json` from synced DB meta
- `gnosys scan` — discover projects under configured roots
