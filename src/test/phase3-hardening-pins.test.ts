import { mkdtempSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { pathToFileURL } from "url";
import { spawn } from "child_process";
import { once } from "events";
import Database from "better-sqlite3";
import { GnosysDB } from "../lib/db.js";
import { GnosysDreamEngine, DreamScheduler } from "../lib/dream.js";
import { DEFAULT_CONFIG } from "../lib/config.js";
import { readDreamState } from "../lib/dreamRunLog.js";
import { makeMemory } from "./_helpers.js";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

describe("Dream crash recovery through persisted state", () => {
  let home: string;
  let db: GnosysDB;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "gnosys-dream-recovery-"));
    vi.stubEnv("GNOSYS_HOME", home);
    db = new GnosysDB(home);
    for (let index = 0; index < 4; index++) db.insertMemory(makeMemory({ id: `checkpoint-${index}`, category: index < 2 ? "decisions" : "concepts", content: "Detailed memory content for an actual category summary and review.", tags: '["test"]', relevance: "checkpoint", confidence: index === 0 ? 0.45 : 0.9, last_reinforced: new Date().toISOString() }));
  });
  afterEach(() => {
    db.close();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    rmSync(home, { recursive: true, force: true });
  });

  it("checkpoints completed phase fingerprints before an interrupted run can finalize", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ message: { content: '{"action":"review","reason":"Verify checkpoint"}' } }));
    const engine = new GnosysDreamEngine(db, DEFAULT_CONFIG, { minMemories: 3 });
    let afterCritique: ReturnType<typeof readDreamState> | undefined;
    await expect(engine.dream((phase, detail) => {
      if (phase === "summaries" && detail.startsWith("Phase")) afterCritique = readDreamState(home);
      if (phase === "relationships" && detail.startsWith("Phase")) throw new Error("simulated process interruption");
    })).rejects.toThrow("simulated process interruption");
    expect(Object.values(afterCritique?.analyzedFingerprints || {}).map(item => ({ kind: item.kind, ids: item.memoryIds }))).toEqual([{ kind: "critique", ids: ["checkpoint-0"] }]);
    const interrupted = readDreamState(home);
    expect(Object.values(interrupted.analyzedFingerprints).map(item => ({ kind: item.kind, ids: item.memoryIds })).sort((a, b) => a.ids.join().localeCompare(b.ids.join()))).toEqual([
      { kind: "critique", ids: ["checkpoint-0"] },
      { kind: "summary", ids: ["checkpoint-0", "checkpoint-1"] },
      { kind: "summary", ids: ["checkpoint-2", "checkpoint-3"] },
    ]);
    expect(interrupted.lastRunAt).toBeUndefined();
    expect(db.getSummary("category", "decisions")?.content).toBe('{"action":"review","reason":"Verify checkpoint"}');
    expect(db.queryAuditLog({ operation: "dream_complete" })).toEqual([]);
  });

  it("scheduler waits for another process to release the Dream lock before writing", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-11T12:00:00.000Z"));
    db.updateMemory("checkpoint-0", { confidence: 0.9, last_reinforced: "2026-01-01T12:00:00.000Z" });
    db.setMeta("machine_id", "lock-machine");
    db.setDreamMachineId("lock-machine");
    const child = spawn(process.execPath, ["--input-type=module", "-e", `import { acquireDreamLock } from ${JSON.stringify(pathToFileURL(resolve("dist/lib/dreamRunLog.js")).href)}; const lock = acquireDreamLock(); if (!lock.acquired) throw new Error(lock.reason); process.stdout.write("LOCKED"); process.stdin.once("data", () => { lock.release(); process.exit(0); });`], { env: { ...process.env, GNOSYS_HOME: home }, stdio: ["pipe", "pipe", "pipe"] });
    const engine = new GnosysDreamEngine(db, DEFAULT_CONFIG, { minMemories: 3, selfCritique: false, generateSummaries: false, discoverRelationships: false });
    const scheduler = new DreamScheduler(engine, { enabled: true, idleMinutes: 1 });
    try {
      expect(String((await once(child.stdout, "data"))[0])).toBe("LOCKED");
      scheduler.start();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(db.getMemory("checkpoint-0")?.confidence).toBe(0.9);
      expect(db.queryAuditLog({ operation: "dream_complete" })).toEqual([]);
      const exit = once(child, "exit");
      child.stdin.write("release\n");
      expect(await exit).toEqual([0, null]);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(db.getMemory("checkpoint-0")?.confidence).toBe(0.86);
      expect(db.queryAuditLog({ operation: "dream_complete" })).toHaveLength(1);
      expect(existsSync(join(home, "dream.lock"))).toBe(false);
    } finally {
      scheduler.stop();
      child.kill();
    }
  });
});

describe("SQLite recovery through public reads and search", () => {
  let home: string;
  let db: GnosysDB;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "gnosys-recovery-audit-"));
    db = new GnosysDB(home);
    db.insertMemory(makeMemory({ id: "recovery-001", title: "Recovery target", content: "originalword" }));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    db.close();
    rmSync(home, { recursive: true, force: true });
  });

  it("retries a native SQLITE_NOTADB read and returns persisted content", () => {
    vi.spyOn(Database.prototype, "prepare").mockImplementationOnce(() => {
      throw Object.assign(new Error("file is not a database"), { code: "SQLITE_NOTADB" });
    });
    expect(db.getMemory("recovery-001")).toMatchObject({ title: "Recovery target", content: "originalword" });
  });

  it("reopens cached reads and restores FTS insert, update and delete behavior", () => {
    expect(db.getMemory("recovery-001")?.title).toBe("Recovery target");
    expect(db.searchFts("originalword").map(memory => memory.id)).toEqual(["recovery-001"]);
    const external = new Database(join(home, "gnosys.db"));
    try {
      external.exec("DROP TRIGGER memories_fts_ai; DROP TRIGGER memories_fts_au; DROP TRIGGER memories_fts_ad;");
    } finally { external.close(); }
    db.reopen();
    expect(db.getMemory("recovery-001")?.content).toBe("originalword");
    db.updateMemory("recovery-001", { content: "replacementword" });
    expect(db.searchFts("originalword")).toEqual([]);
    expect(db.searchFts("replacementword").map(memory => memory.id)).toEqual(["recovery-001"]);
    db.insertMemory(makeMemory({ id: "recovery-002", content: "insertedword" }));
    expect(db.searchFts("insertedword").map(memory => memory.id)).toEqual(["recovery-002"]);
    db.deleteMemory("recovery-002");
    db.insertMemory(makeMemory({ id: "recovery-002", content: "reusedword" }));
    expect(db.searchFts("insertedword")).toEqual([]);
    expect(db.searchFts("reusedword").map(memory => memory.id)).toEqual(["recovery-002"]);
  });

  it("closes the native handle and reopens for fresh reads", () => {
    expect(db.getMemory("recovery-001")?.content).toBe("originalword");
    db.close();
    expect(() => db.getMemory("recovery-001")).toThrow("The database connection is not open");
    const writer = new GnosysDB(home);
    try { writer.updateMemory("recovery-001", { content: "aftercloseword" }); }
    finally { writer.close(); }
    db.reopen();
    expect(db.getMemory("recovery-001")?.content).toBe("aftercloseword");
  });
});
