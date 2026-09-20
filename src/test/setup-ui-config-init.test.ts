/**
 * Phase E — Screen 14 — `gnosys config init` is gated behind --force.
 *
 * Regression covers:
 *   1. Without --force: prints deprecation warning, exits 0, does NOT
 *      write a gnosys.json.
 *   2. With --force: writes a gnosys.json whose `llm` object no longer
 *      contains a literal `defaultProvider` key (Zod fills in the
 *      default on next load until v6.0 removes the schema default).
 *   3. The deprecation warning points the user at `gnosys setup`.
 */

import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import path from "path";
import os from "os";
import fs from "fs";

const CLI = path.resolve("dist/cli.js");

function run(args: string[], home: string): { stdout: string; stderr: string; code: number | null } {
  const result = spawnSync("node", [CLI, ...args], {
    env: {
      ...process.env,
      HOME: home,
      GNOSYS_HOME: home,
      GNOSYS_LOCAL_ONLY: "1",
      GNOSYS_SKIP_UPGRADE_NUDGE: "1",
    },
    encoding: "utf-8",
    timeout: 10_000,
    cwd: home,
  });
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", code: result.status };
}

describe("Phase E — Screen 14 — config init", () => {
  it("without --force prints deprecation warning and does NOT write template", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-cfginit-"));
    try {
      const r = run(["config", "init"], tmp);
      const out = `${r.stdout}\n${r.stderr}`;
      expect(out).toMatch(/gnosys setup/);
      expect(out).toMatch(/blank template/);
      // Must not have written gnosys.json (we exit before the write).
      expect(r.code, out).toBe(0);
      expect(fs.existsSync(path.join(tmp, "gnosys.json"))).toBe(false);
      expect(fs.existsSync(path.join(tmp, ".gnosys", "gnosys.json"))).toBe(false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }, 20_000);

  it("with --force writes a template without defaultProvider hardcoded", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-cfginit-"));
    try {
      // First, set up a writable store so `config init` has somewhere to write.
      const initResult = spawnSync("node", [CLI, "init", "--directory", tmp], {
        env: {
          ...process.env,
          HOME: tmp,
          GNOSYS_HOME: tmp,
          GNOSYS_LOCAL_ONLY: "1",
          GNOSYS_SKIP_UPGRADE_NUDGE: "1",
        },
        encoding: "utf-8",
        timeout: 10_000,
      });
      // gnosys init writes its own gnosys.json into .gnosys/. Remove it so
      // `config init --force` is the one creating the file under test.
      const initJson = path.join(tmp, ".gnosys", "gnosys.json");
      if (fs.existsSync(initJson)) fs.rmSync(initJson);
      expect(initResult.status).toBe(0);

      const r = run(["config", "init", "--force"], tmp);
      const out = `${r.stdout}\n${r.stderr}`;
      expect(r.code, out).toBe(0);
      const parsed: unknown = JSON.parse(fs.readFileSync(initJson, "utf-8"));
      expect(parsed).toMatchObject({
        llm: {
          anthropic: { model: "claude-sonnet-4-6" },
          ollama: { model: "llama3.2", baseUrl: "http://localhost:11434" },
          groq: { model: "llama-3.3-70b-versatile" },
          openai: { model: "gpt-5.4-mini", baseUrl: "https://api.openai.com/v1" },
          lmstudio: { model: "default", baseUrl: "http://localhost:1234/v1" },
          xai: { model: "grok-4.20" },
          mistral: { model: "mistral-small-4" },
          openrouter: { model: "nvidia/nemotron-3-super-120b-a12b:free", baseUrl: "https://openrouter.ai/api/v1" },
        },
        taskModels: {},
        importConcurrency: 5,
      });
      expect(parsed).not.toHaveProperty("llm.defaultProvider");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }, 30_000);
});
