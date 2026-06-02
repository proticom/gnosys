/**
 * Render helpers for `gnosys setup remote` (Screen 6).
 *
 * The wizard's flow is in `lib/remoteWizard.ts`; this module owns only
 * the pure render functions and the sync-mode picker payload so the
 * layout can be snapshot-tested without spinning up an interactive
 * readline.
 */
import { c, color, glyph } from "./ui/tokens.js";
import { Header } from "./ui/header.js";
import { Status } from "./ui/status.js";

/**
 * Sync mode picked in the hierarchical mode menu. Persisted to the
 * `remote_mode` meta key so other tooling can read it back.
 */
export type SyncMode = "read-write" | "pull-only" | "push-only";

/** Description for each mode — shown as the meta column in the picker. */
export const SYNC_MODE_LABELS: Record<SyncMode, string> = {
  "read-write": "this machine reads and writes",
  "pull-only": "read remote, never write",
  "push-only": "write to remote, never read locally",
};

/**
 * Render the validation summary as a bullet list of `✓`/`✗` rows.
 *
 * Replaces `showValidationSummary` in the wizard. Each check is one
 * Status() line — easier to scan than the old col-aligned text dump.
 */
export interface ValidationSummaryInput {
  pathExists: boolean;
  writable: boolean;
  sqliteCompatible: boolean;
  latencyMs: number | null;
  existing?: { found: boolean; memoryCount: number | null; lastModified: string | null };
  warnings: string[];
  errors: string[];
}

export function renderValidationSummary(v: ValidationSummaryInput): string {
  const lines: string[] = [];
  lines.push(Status(v.pathExists ? "ok" : "fail", "path exists"));
  lines.push(Status(v.writable ? "ok" : "fail", "writable"));
  lines.push(Status(v.sqliteCompatible ? "ok" : "fail", "sqlite compatible"));
  if (v.latencyMs !== null) {
    lines.push(Status("ok", "latency", `${v.latencyMs} ms`));
  }
  if (v.existing?.found) {
    const date = v.existing.lastModified ? v.existing.lastModified.split("T")[0] : "unknown";
    const count = v.existing.memoryCount ?? "?";
    lines.push(Status("ok", "found existing remote", `${count} memories · last write ${date}`));
  }
  for (const w of v.warnings) lines.push(Status("warn", w));
  for (const e of v.errors) lines.push(Status("fail", e));
  return lines.join("\n");
}

/** Exact phrase required when declining automatic master backups (v13 design). */
export const BACKUP_RISK_PHRASE = "I ACCEPT THE RISK OF DATA LOSS WITHOUT BACKUPS";

/** Instruction shown when the user declines automatic master backups (v13 design). */
export const BACKUP_DECLINE_ACK_INSTRUCTION =
  "If you answer No, you must type the following phrase to continue:";

/** Guide URL for Tailscale setup (inline fallback when unreachable — todo 14). */
export const TAILSCALE_GUIDE_URL = "https://gnosys.ai/docs/multi-machine-tailscale";

/**
 * v13 first screen — rules before master vs client (design doc §What Happens When…).
 */
export function renderV13ExplanationScreen(): string {
  const lines: string[] = [];
  lines.push(Header(["gnosys", "setup", "multi-machine sync"]));
  lines.push("");
  lines.push(` ${color(c.text, "Multi-machine sync")}`);
  lines.push("");
  lines.push(
    ` ${color(
      c.textDim,
      "Gnosys can share one brain across multiple machines, but only when they can all reach the same master folder.",
    )}`,
  );
  lines.push("");
  lines.push(
    ` ${color(
      c.textDim,
      "This works best with a fast connection (Tailscale, good VPN, or machines on the same local network). Network shares like NAS or slow Tailscale mounts have caused timeouts and lost connections in practice.",
    )}`,
  );
  lines.push("");
  lines.push(` ${color(c.text, "When the master folder is reachable:")}`);
  lines.push(
    ` ${color(c.textDim, "  • Every machine reads from a published snapshot of the master (copied locally).")}`,
  );
  lines.push(
    ` ${color(
      c.textDim,
      "  • New memories from client machines are staged as small files and later processed by the master (usually during idle time, invisibly).",
    )}`,
  );
  lines.push("");
  lines.push(` ${color(c.text, "When the master folder is NOT reachable:")}`);
  lines.push(
    ` ${color(c.textDim, "  • The machine can still write new memories into a small temporary cache.")}`,
  );
  lines.push(` ${color(c.textDim, "  • Old memories cannot be read.")}`);
  lines.push(
    ` ${color(
      c.textDim,
      "  • When the machine reconnects, it will quietly push the staged files so the master can ingest them.",
    )}`,
  );
  return lines.join("\n");
}

/** Master backup acknowledgement block (v13 design). */
export function renderMasterBackupWarning(): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(` ${color(c.text, "Master folder backup")}`);
  lines.push("");
  lines.push(
    ` ${color(c.textDim, "The master folder will become the ONLY copy of your brain.")}`,
  );
  lines.push(
    ` ${color(
      c.textDim,
      "If this machine's disk fails, your data is lost unless you have a backup.",
    )}`,
  );
  lines.push("");
  lines.push(
    ` ${color(
      c.textDim,
      "By default, Gnosys will automatically create daily snapshots of the master database (last 7 days) using SQLite's backup API and store them in master-folder/backups/.",
    )}`,
  );
  lines.push("");
  lines.push(
    ` ${color(
      c.textDim,
      "These are local rollback snapshots for corruption or accidental deletion. They do not protect against disk failure.",
    )}`,
  );
  lines.push("");
  lines.push(
    ` ${color(
      c.textDim,
      "You may optionally provide an off-disk backup location (e.g., external drive or cloud folder) for an extra copy that survives disk loss.",
    )}`,
  );
  return lines.join("\n");
}

/** Typed-phrase prompt when the user disables automatic master backups (v13 design). */
export function renderBackupDeclineAckPrompt(): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(` ${color(c.textDim, BACKUP_DECLINE_ACK_INSTRUCTION)}`);
  lines.push(` ${color(c.text, BACKUP_RISK_PHRASE)}`);
  return lines.join("\n");
}

/**
 * Render the leading Header + current-status line for the remote wizard.
 * Returns a multi-line string the wizard can print as-is.
 */
export function renderRemoteIntro(
  localActive: number,
  localArchived: number,
  currentRemote: string | null,
): string {
  const lines: string[] = [];
  lines.push(Header(["gnosys", "setup", "remote"]));
  lines.push("");
  lines.push(` ${color(c.text, "Multi-machine sync")}`);
  lines.push(
    ` ${color(
      c.textDim,
      "reconfigure or disconnect your master folder (v13 master/client model)",
    )}`,
  );
  lines.push("");
  const remoteTxt = currentRemote ?? "not configured";
  lines.push(`   ${color(c.textDim, "local DB")}    ${color(c.text, `~/.gnosys/gnosys.db (${localActive} active, ${localArchived} archived)`)}`);
  lines.push(`   ${color(c.textDim, "current")}     ${color(c.text, remoteTxt)}`);
  return lines.join("\n");
}

/**
 * Render the final Diff block summarizing what changed at the end of
 * the wizard run.
 */
export interface RemoteDiffInput {
  previousRemote: string | null;
  newRemote: string;
  /** v13 master/client role, or legacy sync mode label for older configs. */
  roleOrMode: string;
}

// ─── v13 sync status copy (design doc — offline / staging / ingest) ─────

/** Shown when the client cannot verify the master is reachable (~30s heartbeat). */
export const MASTER_UNREACHABLE_MESSAGE =
  "Master unreachable; existing memories are unavailable until reconnect.";

export function formatMemoriesWaitingToSync(count: number): string {
  const n = Math.max(0, Math.floor(count));
  return `${n} ${n === 1 ? "memory" : "memories"} waiting to sync`;
}

export function formatFailedToSyncCount(count: number): string {
  const n = Math.max(0, Math.floor(count));
  return `${n} failed to sync`;
}

/** Reconnect banner when offline-staged files are about to push (design doc). */
export function formatOfflinePushStarting(count: number): string {
  const n = Math.max(0, Math.floor(count));
  return `Found ${n} ${n === 1 ? "memory" : "memories"} written while offline. Starting a background task to add them to the master brain.`;
}

export interface ClientSyncStatusInput {
  masterReachable: boolean;
  waitingToSync: number;
  failedToSync: number;
  /** Pending offline adds visible while disconnected (read-your-own-writes overlay). */
  pendingOfflineAdds?: number;
}

/** Multi-line client sync status for panels, MCP, and CLI (pure strings). */
export function renderClientSyncStatusLines(input: ClientSyncStatusInput): string[] {
  const lines: string[] = [];
  if (!input.masterReachable) {
    lines.push(Status("warn", MASTER_UNREACHABLE_MESSAGE));
    if ((input.pendingOfflineAdds ?? 0) > 0) {
      const n = input.pendingOfflineAdds!;
      lines.push(
        Status(
          "progress",
          `Offline — ${n} new ${n === 1 ? "memory" : "memories"} queued locally; older memories hidden until reconnect.`,
        ),
      );
    } else {
      lines.push(
        Status(
          "warn",
          "Offline — only new memories can be added until the master folder is reachable again.",
        ),
      );
    }
    return lines;
  }
  if (input.waitingToSync > 0) {
    lines.push(Status("progress", formatMemoriesWaitingToSync(input.waitingToSync)));
  }
  if (input.failedToSync > 0) {
    lines.push(
      Status("fail", formatFailedToSyncCount(input.failedToSync), "gnosys sync doctor"),
    );
  }
  return lines;
}

export function renderRemoteDiff(d: RemoteDiffInput): string {
  const lines: string[] = [];
  const indent = "   ";
  const arrow = color(c.textGhost, glyph.arrow);
  const fromR = color(c.textMid, (d.previousRemote ?? "not configured").padEnd(20));
  const labelR = color(c.textDim, "master".padEnd(8));
  lines.push(`${indent}${labelR}   ${fromR}   ${arrow}   ${color(c.accentHi, d.newRemote)}`);
  const labelM = color(c.textDim, "role".padEnd(8));
  const fromM = color(c.textMid, "—".padEnd(20));
  lines.push(`${indent}${labelM}   ${fromM}   ${arrow}   ${color(c.accentHi, d.roleOrMode)}`);
  return lines.join("\n");
}
