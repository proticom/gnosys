import path from "path";
import fs from "fs/promises";
import type { GnosysResolver } from "./resolver.js";
import { GnosysDB } from "./db.js";
import {
  loadConfig,
  DEFAULT_CONFIG,
  resolveTaskModel,
  ALL_PROVIDERS,
  getProviderModel,
} from "./config.js";
import { getLLMProvider, isProviderAvailable } from "./llm.js";

type GetResolver = () => Promise<GnosysResolver>;

/**
 * Check whether a legacy per-store gnosys.db is safe to remove.
 * Safe = the file is empty OR every memory in it is already represented
 * in the central DB (matching ID present centrally). This is conservative:
 * we don't compare hashes or content, just IDs. The legacy DB existed
 * pre-v2.0; its memories should have all migrated to central DB long ago.
 */
async function isLegacyStoreSafeToRemove(localDbPath: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const Database = (await import("better-sqlite3")).default;
    const localDb = new Database(localDbPath, { readonly: true });
    localDb.pragma("busy_timeout = 5000");
    let localIds: string[] = [];
    try {
      const rows = localDb.prepare("SELECT id FROM memories").all() as Array<{ id: string }>;
      localIds = rows.map((r) => r.id);
    } catch {
      // Table doesn't exist — file is effectively empty
      localDb.close();
      return { ok: true };
    }
    localDb.close();

    if (localIds.length === 0) return { ok: true };

    const centralDb = GnosysDB.openCentral();
    if (!centralDb.isAvailable()) {
      centralDb.close();
      return { ok: false, reason: "central DB unavailable — cannot verify migration" };
    }
    let missing = 0;
    for (const id of localIds) {
      if (!centralDb.getMemory(id)) missing++;
    }
    centralDb.close();
    if (missing > 0) {
      return { ok: false, reason: `${missing} of ${localIds.length} local memories not found in central DB` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `inspection failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

type LegacyStoreAction = "reported" | "removed" | "kept" | "unsafe";

export interface DoctorReport {
  embeddingRuntime: { available: boolean; message: string | null };
  legacyStore: { path: string; action: LegacyStoreAction; reason: string | null } | null;
  centralDb: {
    path: string;
    status: "migrated" | "not_migrated" | "unavailable" | "not_initialized";
    schemaVersion: number | null;
    memories: { active: number; archived: number; total: number } | null;
    embeddings: { embedded: number; total: number; missing: number; percent: number } | null;
  };
  stores: Array<{ label: string; path: string; memories: number }>;
  archive: { status: "ok" | "unavailable" | "not_initialized"; archived: number | null; dbSizeMB: number | null; oldest: string | null; newest: string | null } | null;
  recall: { mode: "aggressive" | "filtered"; maxMemories: number; minRelevance: number };
  soc: { defaultProvider: string | null; structuring: string | null; synthesis: string | null };
  llm: Array<{ provider: string; status: "unavailable" | "connected" | "error"; detail: string }>;
  maintenance: { active: number; stale: number; staleThreshold: number; averageConfidence: number; averageDecayed: number; neverReinforced: number; totalReinforcements: number } | { error: string } | null;
}

export type DoctorCommandOptions = {
  /** Remove the legacy per-store gnosys.db when every row is already in the central DB. */
  fix?: boolean;
  /** With --fix: remove without prompting (the safety check still applies). */
  yes?: boolean;
  json?: boolean;
};

async function removeLegacyStore(localDbPath: string): Promise<void> {
  await fs.unlink(localDbPath).catch(() => undefined);
  await fs.unlink(localDbPath + "-wal").catch(() => undefined);
  await fs.unlink(localDbPath + "-shm").catch(() => undefined);
}

export async function runDoctorCommand(
  getResolver: GetResolver,
  opts: DoctorCommandOptions,
): Promise<void> {
  if (opts.fix && !opts.yes) {
    const { guardInteractiveStdin } = await import("./interactiveGuard.js");
    if (opts.json) {
      console.error("gnosys doctor --fix --json cannot prompt. Pass --yes to remove safe legacy artifacts.");
      process.exit(1);
    }
    guardInteractiveStdin("doctor --fix", "--yes");
  }
  const report = await collectDoctorReport(getResolver, opts);
  if (opts.json) console.log(JSON.stringify(report, null, 2));
  else for (const line of renderDoctorReport(report)) console.log(line);
}

async function collectDoctorReport(getResolver: GetResolver, opts: DoctorCommandOptions): Promise<DoctorReport> {
  const resolver = await getResolver();
  const stores = resolver.getStores();

  const { checkEmbeddingRuntime } = await import("./embeddingHealth.js");
  const runtime = await checkEmbeddingRuntime();
  const embeddingRuntime = runtime.kind === "available"
    ? { available: true, message: null }
    : { available: false, message: runtime.message };

  // Legacy per-store gnosys.db (pre-v2.0): should not exist in DB-only mode.
  let legacyStore: DoctorReport["legacyStore"] = null;
  if (stores.length > 0) {
    const localDbPath = path.join(stores[0].path, "gnosys.db");
    const localDbExists = await fs.stat(localDbPath).then(() => true).catch(() => false);
    if (localDbExists) {
      legacyStore = { path: localDbPath, action: "reported", reason: null };
      if (opts.fix) {
        // Only remove when every row is already in the central DB.
        const safe = await isLegacyStoreSafeToRemove(localDbPath);
        if (!safe.ok) {
          legacyStore = { path: localDbPath, action: "unsafe", reason: safe.reason ?? null };
        } else {
          let remove = Boolean(opts.yes);
          if (!remove) {
            const readline = await import("readline/promises");
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            try {
              remove = (await rl.question(`Legacy store ${localDbPath} has no rows missing from the central DB. Remove it? [y/N] `)).trim().toLowerCase() === "y";
            } finally {
              rl.close();
            }
          }
          if (remove) await removeLegacyStore(localDbPath);
          legacyStore = { path: localDbPath, action: remove ? "removed" : "kept", reason: null };
        }
      }
    }
  }

  const centralDb: DoctorReport["centralDb"] = {
    path: GnosysDB.getCentralDbPath(),
    status: "not_initialized",
    schemaVersion: null,
    memories: null,
    embeddings: null,
  };
  try {
    const db = GnosysDB.openCentral();
    if (db.isAvailable() && db.isMigrated()) {
      centralDb.status = "migrated";
      centralDb.schemaVersion = db.getSchemaVersion();
      centralDb.memories = db.getMemoryCount();
      const embedded = db.getEmbeddingCount();
      const missing = db.countMemoriesMissingEmbedding();
      const total = embedded + missing;
      // Floor so 3061 of 3062 reads 99.9%, never a misleading 100.0%.
      const percent = total === 0 ? 100 : Math.floor((embedded / total) * 1000) / 10;
      centralDb.embeddings = { embedded, total, missing, percent };
    } else {
      centralDb.status = db.isAvailable() ? "not_migrated" : "unavailable";
    }
    db.close();
  } catch {
    centralDb.status = "not_initialized";
  }

  const storeRows: DoctorReport["stores"] = [];
  for (const s of stores) {
    const memories = await s.store.getAllMemories();
    storeRows.push({ label: s.label, path: s.path, memories: memories.length });
  }

  let archive: DoctorReport["archive"] = null;
  if (stores.length > 0) {
    archive = { status: "not_initialized", archived: null, dbSizeMB: null, oldest: null, newest: null };
    try {
      const { GnosysArchive } = await import("./archive.js");
      const a = new GnosysArchive(stores[0].path);
      if (a.isAvailable()) {
        const stats = a.getStats();
        archive = {
          status: "ok",
          archived: stats.totalArchived,
          dbSizeMB: stats.dbSizeMB,
          oldest: stats.oldestArchived ?? null,
          newest: stats.newestArchived ?? null,
        };
        a.close();
      } else {
        archive.status = "unavailable";
      }
    } catch {
      archive.status = "not_initialized";
    }
  }

  const cfg = stores.length > 0 ? await loadConfig(stores[0].path) : DEFAULT_CONFIG;
  const recall: DoctorReport["recall"] = {
    mode: cfg.recall?.aggressive !== false ? "aggressive" : "filtered",
    maxMemories: cfg.recall?.maxMemories ?? 8,
    minRelevance: cfg.recall?.minRelevance ?? 0.4,
  };
  const taskModel = (task: "structuring" | "synthesis"): string | null => {
    try {
      const t = resolveTaskModel(cfg, task);
      return `${t.provider}/${t.model}`;
    } catch {
      return null;
    }
  };
  // v6.0.0 (deci-049): no implicit anthropic default.
  const soc: DoctorReport["soc"] = {
    defaultProvider: cfg.llm.defaultProvider ?? null,
    structuring: taskModel("structuring"),
    synthesis: taskModel("synthesis"),
  };

  const llm: DoctorReport["llm"] = [];
  for (const providerName of ALL_PROVIDERS) {
    const status = isProviderAvailable(cfg, providerName);
    if (!status.available) {
      llm.push({ provider: providerName, status: "unavailable", detail: String(status.error) });
      continue;
    }
    try {
      const provider = getLLMProvider({ ...cfg, llm: { ...cfg.llm, defaultProvider: providerName } });
      await provider.testConnection();
      llm.push({ provider: providerName, status: "connected", detail: getProviderModel(cfg, providerName) });
    } catch (err) {
      llm.push({ provider: providerName, status: "error", detail: err instanceof Error ? err.message : String(err) });
    }
  }

  // v5.7.0: maintenance health reads the central DB directly.
  let maintenance: DoctorReport["maintenance"] = null;
  if (stores.length > 0) {
    try {
      const db2 = GnosysDB.openCentral();
      if (db2.isAvailable() && db2.isMigrated()) {
        const memories = db2.getActiveMemories();
        const now = Date.now();
        const DECAY_LAMBDA = 0.005;
        const STALE_THRESHOLD = 0.3;
        let sumConfidence = 0;
        let sumDecayed = 0;
        let staleCount = 0;
        let neverReinforced = 0;
        let totalReinforcements = 0;
        for (const m of memories) {
          const baseConfidence = m.confidence ?? 0.8;
          const lastIso = m.last_reinforced || m.modified || m.created;
          const lastTs = lastIso ? new Date(lastIso).getTime() : NaN;
          // Some legacy memories have non-ISO dates that don't parse; treat
          // them as "today" rather than NaN-corrupting the average.
          const daysSince = Number.isFinite(lastTs)
            ? Math.max(0, Math.floor((now - lastTs) / (1000 * 60 * 60 * 24)))
            : 0;
          const decayed = baseConfidence * Math.exp(-DECAY_LAMBDA * daysSince);
          sumConfidence += baseConfidence;
          sumDecayed += decayed;
          if (decayed < STALE_THRESHOLD) staleCount++;
          const rc = m.reinforcement_count ?? 0;
          if (rc === 0) neverReinforced++;
          totalReinforcements += rc;
        }
        const n = Math.max(1, memories.length);
        maintenance = {
          active: memories.length,
          stale: staleCount,
          staleThreshold: STALE_THRESHOLD,
          averageConfidence: sumConfidence / n,
          averageDecayed: sumDecayed / n,
          neverReinforced,
          totalReinforcements,
        };
      }
      db2.close();
    } catch (err) {
      maintenance = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  return { embeddingRuntime, legacyStore, centralDb, stores: storeRows, archive, recall, soc, llm, maintenance };
}

function renderDoctorReport(r: DoctorReport): string[] {
  const out: string[] = ["Gnosys Doctor", "=============\n"];

  out.push("Local embedding runtime:");
  out.push(r.embeddingRuntime.available
    ? "  ✓ available (model loads on first semantic search or reindex)"
    : `  ✗ unavailable. ${r.embeddingRuntime.message}`);
  out.push("");

  if (r.legacyStore) {
    const p = r.legacyStore.path;
    out.push("Local Store (gnosys.db):");
    out.push("  ⚠ Local gnosys.db found — this is a legacy artifact (pre-v2.0 file-based store).");
    out.push(`  All memories live in the central DB now (${r.centralDb.path}).`);
    out.push(`  Path: ${p}`);
    switch (r.legacyStore.action) {
      case "reported":
        out.push("  Run 'gnosys doctor --fix' to remove safely (after verifying it's empty).");
        break;
      case "unsafe":
        out.push(`  ✗ NOT safe to auto-remove: ${r.legacyStore.reason}`);
        out.push(`  Inspect manually with: sqlite3 ${p} "SELECT COUNT(*) FROM memories;"`);
        break;
      case "removed":
        out.push("  ✓ Removed.");
        break;
      case "kept":
        out.push("  Skipped.");
        break;
    }
    out.push("");
  }

  const c = r.centralDb;
  out.push(`Central DB (${c.path}):`);
  if (c.status === "migrated" && c.memories && c.embeddings) {
    out.push(`  Status: ✓ migrated (schema v${c.schemaVersion})`);
    out.push(`  Active: ${c.memories.active} | Archived: ${c.memories.archived} | Total: ${c.memories.total}`);
    const e = c.embeddings;
    out.push(`  Embeddings: ${e.embedded} of ${e.total} memories (${e.percent.toFixed(1)}%)`);
    if (e.missing > 0) {
      out.push(`  ⚠ ${e.missing} ${e.missing === 1 ? "memory lacks an embedding" : "memories lack embeddings"}. Run gnosys reindex to backfill.`);
    }
  } else if (c.status === "not_migrated") {
    out.push("  Status: ✗ not migrated (run gnosys upgrade)");
  } else if (c.status === "unavailable") {
    out.push("  Status: — not available (better-sqlite3 not installed)");
  } else {
    out.push("  Status: — not initialized");
  }
  out.push("");

  out.push("Stores:");
  if (r.stores.length === 0) out.push("  No stores found. Run gnosys init first.");
  for (const s of r.stores) out.push(`  ${s.label}: ${s.memories} memories (${s.path})`);
  out.push("");

  if (r.archive) {
    out.push("Archive (Two-Tier Memory):");
    const a = r.archive;
    if (a.status === "ok") {
      out.push(`  Archived memories: ${a.archived}`);
      if ((a.archived ?? 0) > 0) {
        out.push(`  Archive DB size: ${(a.dbSizeMB ?? 0).toFixed(2)} MB`);
        out.push(`  Oldest archived: ${a.oldest}`);
        out.push(`  Newest archived: ${a.newest}`);
      }
    } else if (a.status === "unavailable") {
      out.push("  Not available (better-sqlite3 not installed)");
    } else {
      out.push("  Not initialized");
    }
    out.push("");
  }

  out.push("Recall (Automatic Memory Injection):");
  out.push(`  Mode: ${r.recall.mode}`);
  out.push(`  Max memories per turn: ${r.recall.maxMemories}`);
  out.push(`  Min relevance: ${r.recall.minRelevance}`);
  out.push("");

  const notSet = "not set — run gnosys setup";
  out.push("System of Cognition (SOC):");
  out.push(`  Default provider: ${r.soc.defaultProvider ?? notSet}`);
  out.push(`  Structuring → ${r.soc.structuring ?? notSet}`);
  out.push(`  Synthesis   → ${r.soc.synthesis ?? notSet}`);
  out.push("");

  out.push("LLM Connectivity:");
  for (const l of r.llm) {
    if (l.status === "unavailable") out.push(`  ${l.provider}: — ${l.detail}`);
    else if (l.status === "connected") out.push(`  ${l.provider}: ✓ connected (${l.detail})`);
    else out.push(`  ${l.provider}: ✗ ${l.detail}`);
  }
  out.push("");

  if (r.stores.length > 0) {
    out.push("Maintenance Health:");
    const m = r.maintenance;
    if (m === null) {
      out.push("  — central DB not available");
    } else if ("error" in m) {
      out.push(`  Error: ${m.error}`);
    } else {
      out.push(`  Active memories: ${m.active}`);
      out.push(`  Stale (decayed confidence < ${m.staleThreshold}): ${m.stale}`);
      out.push(`  Average confidence: ${m.averageConfidence.toFixed(3)} (decayed: ${m.averageDecayed.toFixed(3)})`);
      out.push(`  Never reinforced: ${m.neverReinforced}`);
      out.push(`  Total reinforcements: ${m.totalReinforcements}`);
    }
  }
  return out;
}
