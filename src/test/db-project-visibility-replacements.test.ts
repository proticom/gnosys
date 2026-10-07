/**
 * projectRoot visibility must also hold for superseded-memory replacements.
 * searchFts and discoverFts pull in the successor of a superseded hit; when
 * that successor lives in another project it must not leak into a
 * project-scoped read.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { GnosysDB, type DbMemory } from "../lib/db.js";

let tmp: string;
let db: GnosysDB;

function row(id: string, projectId: string, extra: Partial<DbMemory> = {}): DbMemory {
  return {
    id,
    title: `Narwhalprism ${id}`,
    category: "decisions",
    content: `# Narwhalprism ${id}\n\nnarwhalprism body`,
    summary: null,
    tags: "[]",
    relevance: "narwhalprism",
    author: "ai",
    authority: "declared",
    confidence: 0.9,
    reinforcement_count: 0,
    content_hash: `hash-${id}`,
    status: "active",
    tier: "active",
    supersedes: null,
    superseded_by: null,
    last_reinforced: null,
    created: "2026-10-06",
    modified: "2026-10-06",
    embedding: null,
    source_path: null,
    source_file: null,
    source_page: null,
    source_timerange: null,
    project_id: projectId,
    scope: "project",
    ...extra,
  } as DbMemory;
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-vis-replacement-"));
  db = new GnosysDB(tmp);
  // p1's memory was superseded by a memory that belongs to p2.
  db.insertMemory(row("deci-p1-old", "p1", { status: "superseded", superseded_by: "deci-p2-new" }));
  db.insertMemory(row("deci-p2-new", "p2", { supersedes: "deci-p1-old" }));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("superseded replacements under project visibility", () => {
  it("searchFts scoped to p1 does not pull in p2's successor", () => {
    const ids = db.searchFts("narwhalprism", 10, false, { projectId: "p1" }).map((r) => r.id);
    expect(ids).toEqual(["deci-p1-old"]);
  });

  it("discoverFts scoped to p1 does not pull in p2's successor", () => {
    const ids = db
      .discoverFts("narwhalprism", 10, false, { visibility: { projectId: "p1" } })
      .map((r) => r.id);
    expect(ids).toEqual(["deci-p1-old"]);
  });

  it("unscoped searchFts still ranks the successor before its predecessor", () => {
    const ids = db.searchFts("narwhalprism", 10).map((r) => r.id);
    expect(ids).toEqual(["deci-p2-new", "deci-p1-old"]);
  });

  it.each(["project", "user", "global"])("context dedupe excludes a successor in another %s boundary", (scope) => {
    db.updateMemory("deci-p2-new", { scope });
    const ids = db.discoverFts("narwhalprism", 3, false, { scope: "project", projectId: "p1" }).map((hit) => hit.id);
    expect(ids).toEqual(["deci-p1-old"]);
  });
});
