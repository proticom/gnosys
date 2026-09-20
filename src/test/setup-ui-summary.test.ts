import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { createInterface } from "node:readline/promises";
import { GnosysDB } from "../lib/db.js";
import { loadConfig } from "../lib/config.js";
import { describeMultiMachineSyncPanel, formatMultiMachineSyncSummary, runSummaryWizard } from "../lib/setup/summary.js";

vi.mock("child_process", async (original) => ({
  ...await original<typeof import("child_process")>(),
  execSync: vi.fn(() => { throw new Error("External command unavailable in fixture"); }),
}));

let home: string;
let project: string;
let previousEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  previousEnv = { ...process.env };
  home = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-summary-behavior-"));
  project = path.join(home, "project");
  fs.mkdirSync(path.join(project, ".gnosys"), { recursive: true });
  process.env.GNOSYS_HOME = path.join(home, "brain");
  process.env.GNOSYS_CONFIG_DIR = path.join(home, "config");
  process.env.HOME = home;
  for (const key of Object.keys(process.env)) {
    if (/(API_KEY|_KEY)$/.test(key)) delete process.env[key];
  }
  vi.spyOn(os, "homedir").mockReturnValue(home);
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = previousEnv;
  fs.rmSync(home, { recursive: true, force: true });
});

function config(value: unknown): void {
  fs.writeFileSync(path.join(project, ".gnosys", "gnosys.json"), JSON.stringify(value));
}

async function wizard(answers = ["done"]): Promise<{ changed: boolean; text: string }> {
  const input = new PassThrough();
  const output = new PassThrough();
  const rl = createInterface({ input, output });
  vi.spyOn(rl, "question").mockImplementation(async () => {
    const answer = answers.shift();
    if (answer === undefined) throw new Error("Unexpected wizard prompt");
    return answer;
  });
  const writes: string[] = [];
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((value) => {
    writes.push(String(value));
    return true;
  });
  try {
    const changed = await runSummaryWizard({ directory: project, rl });
    expect(answers).toEqual([]);
    return { changed, text: writes.join("").replace(/\x1b\[[0-9;]*m/g, "") };
  } finally {
    spy.mockRestore();
    rl.close();
    input.destroy();
    output.destroy();
  }
}

describe("Phase C — settings panel (summary)", () => {
  it("formatMultiMachineSyncSummary shows NA when remote is not configured", () => {
    expect(formatMultiMachineSyncSummary(null)).toBe("NA (single-machine only)");
    expect(formatMultiMachineSyncSummary("/Volumes/Dev/gnosys")).toBe("/Volumes/Dev/gnosys");
  });

  it("describeMultiMachineSyncPanel shows NA with no remote meta or machine config", async () => {
    await expect(describeMultiMachineSyncPanel()).resolves.toBe("NA (single-machine only)");
    const db = GnosysDB.openLocal();
    try { db.setMeta("remote_path", "/Volumes/Dev/gnosys"); } finally { db.close(); }
    await expect(describeMultiMachineSyncPanel()).resolves.toBe("/Volumes/Dev/gnosys");
  });

  it("renders panel row 4 with NA when multi-machine sync is not configured", async () => {
    config({});
    const result = await wizard();
    expect(result.changed).toBe(false);
    expect(result.text).toContain(" 4   multi-machine sync   NA (single-machine only)");
  });

  it("renders panel rows for a fresh config (no default provider)", async () => {
    config({});
    const result = await wizard();
    expect(result.changed).toBe(false);
    for (const row of [
      " 1   providers            no keys stored",
      " 2   task routing         not set — configure providers first",
      " 5   dream mode           disabled",
      " 6   user preferences     0 stored",
    ]) expect(result.text).toContain(row);
    expect(result.text).toContain("gnosys settings");
  });

  it("renders panel rows after a switch to xai", async () => {
    config({ llm: { defaultProvider: "xai", xai: { model: "grok-4.20" } } });
    const result = await wizard();
    expect(result.text).toContain(" 2   task routing         all xai");
    expect(result.changed).toBe(false);
  });

  it("marks an edited routing section after saving and reloading its config", async () => {
    config({ llm: { defaultProvider: "ollama" }, taskModels: { structuring: { provider: "xai", model: "grok-4.20" } } });
    const result = await wizard(["2", "4", "y", "done"]);
    expect(result.changed).toBe(true);
    const routingRows = result.text.split("\n").filter(line => line.includes(" 2   task routing"));
    expect(routingRows).toHaveLength(2);
    expect(routingRows[0]).toContain("mixed (xai, ollama)");
    expect(routingRows[1]).toMatch(/all ollama\s+✓/);
  });

  it("DEF-G1-001 reset routing clears persisted task overrides", async () => {
    config({ llm: { defaultProvider: "ollama" }, taskModels: { structuring: { provider: "xai", model: "grok-4.20" } } });
    await wizard(["2", "4", "y", "done"]);
    expect((await loadConfig(path.join(project, ".gnosys"))).taskModels).toEqual({});
  });
});
