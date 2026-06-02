# Multi-Machine Sync (v13)

## Known limitations

- **No offline reads on clients** — when the master folder is unreachable, existing memories are hidden; only new offline adds are visible.
- **Background sync depends on agent start or OS timer** — staged files push when an agent runs or a scheduled task fires.
- **Higher latency** — clients read published snapshots, not the live master database.
- **Add-only clients** — connected clients stage new memories; update/reinforce/delete on clients is deferred.
- **Offline cache is not auto-backed up** — `~/.gnosys/offline-memories/` is local-only unless you back it up yourself.

## Commands

- `gnosys setup remote` — configure master or client
- `gnosys setup remote status` — reachability, waiting/failed counts
- `gnosys setup remote doctor` — diagnostics and optional `--ingest` on master

## Master folder rules

- Master `gnosys.db` must live on the **master machine's local disk** (not NAS/cloud mount).
- Clients reach the master folder via VPN (usually Tailscale) as a normal path on each machine.
