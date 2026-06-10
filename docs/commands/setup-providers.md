# gnosys setup providers

Manage LLM provider API keys (view, rotate, delete). Keys are stored securely per-platform (Keychain on macOS, secret-tool on Linux, Windows Credential Manager) with fallbacks to `~/.config/gnosys/.env` or environment variables (`ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, etc.). The `GNOSYS_*_KEY` global names take precedence for multi-provider setups.

## Usage

```bash
gnosys setup providers
gnosys setup providers --provider openrouter --rotate
gnosys setup providers --list
```

## Options

- `--provider <name>` — Target a specific provider (`anthropic`, `openai`, `xai`, `groq`, `mistral`, `openrouter`, `ollama`, `lmstudio`, `custom`, etc.).
- `--rotate` / `--delete` / `--list` — Non-interactive actions.
- Interactive table mode when no flags (add, view last-four, rotate, delete).

## Behavior

- Lists all known providers with presence, last-four snippet, and storage location.
- On add/rotate: prompts for key (masked), validates with a cheap API call where possible, stores securely.
- `setup keys` (table view) and `setup providers` are related entry points; `providers` is the classic per-provider flow.
- Keys are never stored in gnosys config or DB; only references/locations.

## Writes and side effects

- Platform secure store (Keychain / secret service / Credential Manager) or `~/.config/gnosys/.env`.
- Updates `~/.gnosys/gnosys.json` only for provider/model routing (not the raw keys).

## Platform notes

### macOS
- Primary: macOS Keychain (via `security` / node-keytar equivalent in apiKeyVault).
- Fallback: `~/.config/gnosys/.env` (chmod 600 recommended).
- Env vars: `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `GNOSYS_ANTHROPIC_KEY`, etc. `GNOSYS_*_KEY` variants win.

### Linux
- Primary: secret-tool / libsecret (GNOME Keyring, KeePassXC, etc.).
- Fallback: `~/.config/gnosys/.env`.
- Headless/CI: prefer env vars or a mounted secret file.

### Windows
- Primary: Windows Credential Manager (via node-keytar / wincred).
- Fallback: `~/.config/gnosys/.env` (or `%APPDATA%\gnosys\.env`).
- PowerShell / WSL interop: env vars are reliable.

## Related

- `gnosys setup keys` — modern table UI for the same storage.
- `gnosys setup models` / `routing` — after keys are present.
- `gnosys connect` — for pointing IDEs at a remote (network-hosted) gnosys instance.
- Environment: `GNOSYS_HOME`, `GNOSYS_LLM_API_KEY` (global fallback).

## Security notes

- Never commit keys.
- Use `gnosys setup providers --delete` or the OS keychain UI to remove.
- The server (stdio or `--transport http`) only sees keys at LLM call time via the resolved config.
