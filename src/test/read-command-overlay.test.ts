/**
 * v5.12.1 — `gnosys read <id>` client read overlay.
 *
 * list/discover/search already route through resolveClientRead so pending
 * offline adds are visible; read-by-id used to call centralDb.getMemory
 * directly and could not open a memory that list had just shown. These
 * tests pin the wiring (readCommand → clientReadResolve) and the overlay
 * fallback behavior of getMemoryWithOverlay itself.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { getMemoryWithOverlay, type ResolvedClientRead } from "../lib/clientReadResolve.js";
import type { PendingAddRow } from "../lib/clientReadOverlay.js";

describe("gnosys read command overlay wiring", () => {
  const handler = readFileSync(join(process.cwd(), "src/lib/readCommand.ts"), "utf-8");

  it("routes read-by-id through the client read overlay like its siblings", () => {
    expect(handler).toContain('await import("./clientReadResolve.js")');
    expect(handler).toContain("getMemoryWithOverlay(resolved");
    expect(handler).toContain("resolved.release()");
    // The pre-fix direct central read must be gone
    expect(handler).not.toContain("GnosysDB.openCentral()");
  });

  it("keeps the legacy resolver fallback for markdown stores", () => {
    expect(handler).toContain("resolver.readMemory(memoryPath)");
    expect(handler).toContain("Memory not found");
  });
});

describe("getMemoryWithOverlay", () => {
  const pendingRow: PendingAddRow = {
    id: "01PENDING",
    title: "Pending offline add",
    category: "concepts",
    content: "written while master was unreachable",
    tags: "[]",
    project_id: null,
    scope: "global",
    created: "2026-06-11T00:00:00.000Z",
  };

  function makeResolved(overlay: PendingAddRow[]): ResolvedClientRead {
    // Minimal stand-in: db.getMemory misses so the overlay must answer.
    const db = { getMemory: () => null } as unknown as ResolvedClientRead["db"];
    return {
      db,
      localDb: db,
      pendingOverlay: overlay,
      clientRead: null,
      release: () => {},
    };
  }

  it("falls back to the pending overlay when the DB misses", () => {
    const mem = getMemoryWithOverlay(makeResolved([pendingRow]), "01PENDING");
    expect(mem).not.toBeNull();
    expect(mem?.id).toBe("01PENDING");
    expect(mem?.title).toBe("Pending offline add");
    expect(mem?.status).toBe("active");
    // Synthesized DbMemory must carry the attachment columns (v5.12 schema)
    expect(mem?.attachment_data).toBeNull();
    expect(mem?.attachment_mime).toBeNull();
    expect(mem?.attachment_name).toBeNull();
  });

  it("returns null when neither DB nor overlay has the id", () => {
    expect(getMemoryWithOverlay(makeResolved([pendingRow]), "01MISSING")).toBeNull();
    expect(getMemoryWithOverlay(makeResolved([]), "01PENDING")).toBeNull();
  });
});
