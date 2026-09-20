/**
 * Phase H — `gnosys cleanup` classification + non-interactive cleanup.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

let tmpConfig: string;
let tmpHome: string;
let nonTmpHome: string;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-cleanup-home-"));
  tmpConfig = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-cleanup-cfg-"));
  nonTmpHome = path.join(path.parse(process.cwd()).root, "gnosys-cleanup-fixture", path.basename(tmpHome));
  const statSync = fs.statSync;
  vi.spyOn(fs, "statSync").mockImplementation((file, options) => {
    const value = String(file);
    const target = value.startsWith(nonTmpHome + path.sep) ? path.join(tmpHome, path.relative(nonTmpHome, value)) : file;
    return statSync(target, options);
  });
  vi.stubEnv("HOME", nonTmpHome);
  vi.stubEnv("GNOSYS_CONFIG_DIR", tmpConfig);
});

afterEach(() => {
  fs.rmSync(tmpHome, { recursive: true, force: true });
  fs.rmSync(tmpConfig, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function load() {
  // Late-load to ensure paths.ts captures the env vars.
  return await import("../lib/cleanup.js");
}

function writeRegistry(entries: string[]): void {
  fs.writeFileSync(path.join(tmpConfig, "projects.json"), JSON.stringify(entries));
}

describe("Phase H — gnosys cleanup classification", () => {
  it("alive: directory with .gnosys/ subdir", async () => {
      const realDir = path.join(nonTmpHome, "real-project");
      fs.mkdirSync(path.join(tmpHome, path.relative(nonTmpHome, realDir), ".gnosys"), { recursive: true });
      writeRegistry([realDir]);

      const { classifyRegistryEntries } = await load();
      const result = await classifyRegistryEntries();
      expect(result.alive).toContain(realDir);
      expect(result.dead).toHaveLength(0);
      expect(result.temp).toHaveLength(0);
  });

  it("dead: directory exists but no .gnosys/", async () => {
    const deadDir = path.join(nonTmpHome, "no-gnosys-here");
    fs.mkdirSync(path.join(tmpHome, path.relative(nonTmpHome, deadDir)), { recursive: true });
    writeRegistry([deadDir]);

    const { classifyRegistryEntries } = await load();
    const result = await classifyRegistryEntries();
    expect(result.dead).toContain(deadDir);
  });

  it("dead: directory does not exist at all", async () => {
    const phantom = path.join(nonTmpHome, "never-existed");
    writeRegistry([phantom]);
    const { classifyRegistryEntries } = await load();
    const result = await classifyRegistryEntries();
    expect(result.dead).toContain(phantom);
  });

  it("temp: path under /tmp or /var/folders is classified as temp", async () => {
    // os.tmpdir() resolves to /var/folders/... on macOS or /tmp on Linux —
    // either way isTempPath() should return true.
    const tempProject = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-temp-proj-"));
    try {
      writeRegistry([tempProject]);
      const { classifyRegistryEntries } = await load();
      const result = await classifyRegistryEntries();
      expect(result.temp).toContain(tempProject);
    } finally {
      fs.rmSync(tempProject, { recursive: true, force: true });
    }
  });

  it("no registry → empty categories", async () => {
    const { classifyRegistryEntries } = await load();
    const result = await classifyRegistryEntries();
    expect(result.alive).toEqual([]);
    expect(result.dead).toEqual([]);
    expect(result.temp).toEqual([]);
  });
});

describe("Phase H — gnosys cleanup non-interactive write", () => {
  it("with yes=true removes dead+temp and keeps alive", async () => {
    const realDir = path.join(nonTmpHome, "real");
    fs.mkdirSync(path.join(tmpHome, path.relative(nonTmpHome, realDir), ".gnosys"), { recursive: true });
    const deadDir = path.join(nonTmpHome, "no-gnosys");
    fs.mkdirSync(path.join(tmpHome, path.relative(nonTmpHome, deadDir)), { recursive: true });
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-temp-"));

    try {
      writeRegistry([realDir, deadDir, tempDir]);
      const { cleanupRegistry } = await load();
      const result = await cleanupRegistry({ interactive: false, yes: true });

      expect(result.removed).toBe(2);
      expect(result.kept).toBe(1);
      expect(result.wrote).toBe(true);

      // Registry should now contain only the alive entry.
      const after = JSON.parse(fs.readFileSync(path.join(tmpConfig, "projects.json"), "utf-8")) as string[];
      expect(after).toEqual([realDir]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("dry-run (interactive=false, yes=false) does NOT write", async () => {
    const deadDir = path.join(nonTmpHome, "no-gnosys-2");
    fs.mkdirSync(path.join(tmpHome, path.relative(nonTmpHome, deadDir)), { recursive: true });
    writeRegistry([deadDir]);

    const before = fs.readFileSync(path.join(tmpConfig, "projects.json"), "utf-8");
    const { cleanupRegistry } = await load();
    const result = await cleanupRegistry({ interactive: false, yes: false });
    expect(result.wrote).toBe(false);
    expect(result.removed).toBe(1);

    const after = fs.readFileSync(path.join(tmpConfig, "projects.json"), "utf-8");
    expect(after).toBe(before);
  });

  it("no stale entries → no write, removed=0", async () => {
    const realDir = path.join(nonTmpHome, "real-2");
    fs.mkdirSync(path.join(tmpHome, path.relative(nonTmpHome, realDir), ".gnosys"), { recursive: true });
    writeRegistry([realDir]);

    const { cleanupRegistry } = await load();
    const result = await cleanupRegistry({ interactive: false, yes: true });
    expect(result.removed).toBe(0);
    expect(result.kept).toBe(1);
    expect(result.wrote).toBe(false);
  });
});
