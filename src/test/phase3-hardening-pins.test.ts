/**
 * v5.12.x Phase 3/4 hardening pins — marker tests so refactors cannot
 * silently drop the reliability changes shipped in the production overhaul:
 *
 *  - Dream fingerprints checkpoint at every phase boundary (crash safety)
 *  - Dream scheduler takes the cross-process file lock
 *  - withRecovery uses the shared corruption detector and reopen() heals FTS
 *  - Statement cache invalidation on reopen/close (stale-handle safety)
 *  - Scoped GnosysSearch handles are released centrally (ownsSearch)
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");

describe("dream crash-safety pins", () => {
  const dream = read("src/lib/dream.ts");

  it("checkpoints fingerprints at every phase boundary", () => {
    expect(dream).toContain("private checkpointFingerprints()");
    // finishPhase is the single phase-boundary funnel — the checkpoint lives there
    expect(dream).toMatch(/finishPhase\([\s\S]{0,400}?this\.checkpointFingerprints\(\);/);
    // checkpoint merges fingerprints but must not claim a completed run
    const body = dream.slice(dream.indexOf("private checkpointFingerprints()"));
    expect(body.slice(0, 600)).not.toContain("lastRunAt");
  });

  it("scheduler acquires the cross-process dream lock before dreaming", () => {
    expect(dream).toContain("const lock = acquireDreamLock();");
    expect(dream).toContain("lock.release();");
  });
});

describe("sqlite recovery pins", () => {
  const db = read("src/lib/db.ts");

  it("withRecovery uses the shared corruption detector (incl. SQLITE_NOTADB)", () => {
    expect(db).toContain("if (!GnosysDB.isCorruptionError(err)) throw err;");
  });

  it("reopen() heals FTS triggers and invalidates the statement cache", () => {
    const reopen = db.slice(db.indexOf("reopen(): void {"), db.indexOf("reopen(): void {") + 1200);
    expect(reopen).toContain("this.stmtCache.clear();");
    expect(reopen).toContain("FTS_TRIGGERS_SQL");
  });

  it("close() invalidates the statement cache", () => {
    expect(db).toMatch(/close\(\): void \{\s*this\.stmtCache\.clear\(\);/);
  });
});

describe("scoped search release pin", () => {
  const idx = read("src/index.ts");

  it("projectRoot-scoped contexts own and release their GnosysSearch handle", () => {
    expect(idx).toContain("ownsSearch: scopedSearch !== null");
    expect(idx).toMatch(/if \(ctx\.ownsSearch && ctx\.search\) \{/);
  });
});
