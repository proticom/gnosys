# Isolated Setup UI Tests

End-to-end tests for the **interactive** parts of the gnosys CLI — the setup
wizard, `gnosys init`, and the `gnosys web init` wizard — driven exactly the
way a human uses them: keystrokes against a real terminal.

## Why a container

Unit tests can't safely exercise the real interactive wizards: they read the
real TTY, and a stray run could touch the developer's actual `~/.gnosys`,
`~/.config/gnosys`, or IDE rule files. This suite runs everything inside a
throwaway Docker container:

- The CLI under test is installed from a locally packed tarball (`npm pack`)
  — the exact artifact users install from npm.
- The container runs as a non-root user with **no host mounts** and
  **no network** (`--network=none`).
- `expect` scripts type into the wizards and assert on the rendered screens.
- A final isolation audit asserts gnosys wrote only under the expected
  locations inside the container home.

## Running

```bash
npm run test:e2e-setup     # requires Docker
```

Not part of `npm test` (vitest) because it needs a Docker daemon.

## Tests

| Test | What it proves |
|---|---|
| `version.sh` | Packed tarball installs globally and runs |
| `init.exp` | `gnosys init` creates the project store, exit 0 |
| `setup-wizard.exp` | `gnosys setup --full` renders its first screen; Ctrl+C exits gracefully ("cancelled · no changes written"), never a stack trace |
| `setup-non-interactive.sh` | `--non-interactive` completes with no TTY |
| `web-init.exp` | The 3-step web wizard accepts answers and creates `knowledge/` |
| `isolation.sh` | No writes outside `$HOME/.gnosys`, `$HOME/.config/gnosys`, and the test project dirs |

## Gotcha for future authors

expect's gate-keeper glob is **case-sensitive even when your regex has
`(?i)`** — patterns must use the wizard's exact casing or they silently never
match. Also give readline a beat (`sleep 1`) before `send`, or keystrokes can
arrive before the prompt is listening.
