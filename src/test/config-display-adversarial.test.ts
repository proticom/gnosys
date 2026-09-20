import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { z } from "zod";

let directory: string;
let env: NodeJS.ProcessEnv;
let configFile: string;
const canary = "fixture-only-config-key-7f94a31c";
const cli = path.resolve("dist/cli.js");
const displayedConfig = z.object({ llm: z.object({ defaultProvider: z.string(), custom: z.object({ model: z.string(), baseUrl: z.string() }) }) });
beforeEach(() => {
  directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-config-display-adversarial-")));
  env = { PATH: process.env.PATH, HOME: directory, GNOSYS_HOME: path.join(directory, "brain"), GNOSYS_CONFIG_DIR: path.join(directory, "config"), GNOSYS_LOCAL_ONLY: "1", GNOSYS_SKIP_UPGRADE_NUDGE: "1", VITEST: "true", CI: "true" };
  const initialized = spawnSync(process.execPath, [cli, "init"], { cwd: directory, env, encoding: "utf8" });
  if (initialized.status !== 0) throw new Error(initialized.stderr);
  configFile = path.join(directory, ".gnosys", "gnosys.json");
  const identity = z.record(z.string(), z.unknown()).parse(JSON.parse(fs.readFileSync(configFile, "utf8")));
  fs.writeFileSync(configFile, JSON.stringify({ ...identity, llm: { defaultProvider: "custom", custom: { model: "display-canary-model", baseUrl: "http://provider.invalid/v1", apiKey: canary } } }));
});
afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

describe("adversarial config display", () => {
  it("human config output names the key source without exposing stored key bytes", () => {
    const result = spawnSync(process.execPath, [cli, "config", "show"], { cwd: directory, env, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Default provider: custom");
    expect(result.stdout).toContain("Custom:     model=display-canary-model, url=http://provider.invalid/v1, apiKey=config");
    expect(result.stdout + result.stderr).not.toContain(canary);
    expect(fs.readFileSync(configFile, "utf8")).toContain(canary);
  });

  it.fails("ADV-CTX-001 JSON config output preserves model metadata without exposing stored key bytes", () => {
    const result = spawnSync(process.execPath, [cli, "config", "show", "--json"], { cwd: directory, env, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    expect(displayedConfig.parse(JSON.parse(result.stdout))).toEqual({ llm: { defaultProvider: "custom", custom: { model: "display-canary-model", baseUrl: "http://provider.invalid/v1" } } });
    expect(result.stdout + result.stderr).not.toContain(canary);
    expect(fs.readFileSync(configFile, "utf8")).toContain(canary);
  });
});
