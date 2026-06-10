# gnosys setup keys

Interactive table UI for managing LLM provider API keys across all supported providers. Replaces/augments the classic per-provider flow with a single view, last-four masking, rotate, copy-to-keychain, and delete actions. Storage is the same secure platform backend used by `setup providers`.

## Usage

```bash
gnosys setup keys
gnosys setup keys --non-interactive
```

## Behavior

- Renders a table of providers (anthropic, openrouter, openai, xai, groq, ... custom, local).
- Columns: provider mark, presence, last-four, location (keychain / env / dotenv / none).
- Actions (interactive): add/rotate key (masked prompt + validation), copy existing to OS keychain, delete from all stores, refresh.
- Local providers (ollama, lmstudio) are shown but usually don't require keys.
- OpenRouter gets special tier handling (including :free models) via the new openrouterTiers builder.

## Writes and side effects

- Same as `setup providers`: platform secure store + optional `~/.config/gnosys/.env`.
- Never writes raw keys to gnosys config or the central DB.
- May trigger a cheap validation call to the provider's API.

## Platform notes

### macOS
- Preferred store: macOS Keychain (via apiKeyVault + security framework).
- Env fallback: `~/.config/gnosys/.env` (0600).
- `GNOSYS_*_KEY` global names (e.g. `GNOSYS_OPENROUTER_KEY`) take precedence over legacy `OPENROUTER_API_KEY`.

### Linux
- Preferred: secret-tool / libsecret (works with GNOME Keyring, KeePassXC, etc.).
- Fallback: `~/.config/gnosys/.env`.
- CI/headless: rely on environment variables.

### Windows
- Preferred: Windows Credential Manager.
- Fallback: `~/.config/gnosys/.env` under the user profile.
- WSL: env vars or the Windows credential store via interop.

## Related commands

- `gnosys setup providers` — the classic linear per-provider wizard.
- `gnosys setup models` / `gnosys setup routing` — configure which key+model is used for each task after keys exist.
- `gnosys connect` — point Cursor/Claude/etc. at a remote (HTTP) gnosys instance instead of local stdio.
- `gnosys serve --transport http` — the server side of the network-hosted topology.

## Security & recovery

- Use your OS keychain UI or `gnosys setup keys` delete action to remove keys.
- `gnosys setup sync-projects` or a fresh `gnosys init` never touches keys.
- For air-gapped / local-only: `ollama` and `lmstudio` entries require no key.
