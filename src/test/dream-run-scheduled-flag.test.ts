import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GnosysDB } from "../lib/db.js";
import { cliInit, cli, makeMemory } from "./_helpers.js";

describe("dream run --scheduled flag handling (v5.13.1)", () => {
  it("scheduled run records designation-gate skip", () => {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-scheduled-cli-"));
    try {
      cliInit(project);
      const db = new GnosysDB(path.join(project, ".test-central"));
      db.insertMemory(makeMemory({ id: "scheduled-fixture", scope: "user" }));
      db.close();
      const output = cli("dream run --scheduled", project);
      expect(output).toBe("");
      const runs = fs.readFileSync(path.join(project, ".test-central", "dream-runs.jsonl"), "utf8").trim().split("\n").map(line => JSON.parse(line));
      expect(runs).toHaveLength(1);
      expect(runs[0]).toMatchObject({ trigger: "scheduled", status: "skipped", gates: [{ name: "designation", passed: false, reason: "No designated dream machine." }] });
    } finally { fs.rmSync(project, { recursive: true, force: true }); }
  });
});
