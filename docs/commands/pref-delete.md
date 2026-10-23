# gnosys pref delete

Delete a user-scoped preference by key.

## Usage

```bash
gnosys pref delete <key>
gnosys pref delete code-style
```

## Behavior

1. Opens the central DB via `GnosysDB.openCentral()`.
2. Asks a human to type the key. Deletion follows the [memory deletion rule](../memory-deletion.md): without a terminal it is refused unless a human set `GNOSYS_ALLOW_MEMORY_DELETE=1`. Agents should mark the preference `superseded` or `archived` instead.
3. Calls `deletePreference(centralDb, key)`.
4. Prints confirmation or a missing-key message.
5. Reminds you to run `gnosys sync` to update agent rules files after a successful delete.

## Output

**Success:**

```text
Preference "code-style" deleted.
Run 'gnosys sync' to update agent rules files.
```

**Missing key:**

```text
No preference found for key "unknown-key".
```

## Errors

Central DB unavailable:

```text
Central DB not available (node:sqlite unavailable; requires Node ^22.16.0 || >=24.0.0).
```

Other errors:

```text
Error: <message>
```

Failure paths set `process.exitCode = 1` and return through `finally`.

## Validation

```bash
cd gnosys-public
npm run cli -- pref delete --help
node scripts/audit-commands.mjs --write
```

## Related commands

- [gnosys pref](pref.md) — parent command overview
- [gnosys pref set](pref-set.md) — set a preference
- [gnosys pref get](pref-get.md) — read preferences
- `gnosys sync` — regenerate agent rules from preferences
