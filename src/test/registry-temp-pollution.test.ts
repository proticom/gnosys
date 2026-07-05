/**
 * v5.15.4 — regression tests for temp-dir pollution of the project registry.
 *
 * Bug: test suites spawn the real CLI with GNOSYS_HOME pointed at a tmpdir,
 * which isolated the central DB — but the file registry at
 * ~/.config/gnosys/projects.json only honored GNOSYS_CONFIG_DIR, so every
 * test run leaked hundreds of /var/folders/... entries into the user's real
 * registry. `gnosys setup sync-projects` then reported "syncing 543
 * registered projects" and re-persisted the ghosts forever.
 *
 * Fixes under test:
 *   1. getProjectRegistryPath() honors GNOSYS_HOME ($GNOSYS_HOME/config).
 *   2. isTempProjectPath() classifies temp locations (shared helper).
 *   3. GnosysResolver.registerProject() refuses temp paths when writing to
 *      the real (non-isolated) registry, but allows them when GNOSYS_HOME
 *      or GNOSYS_CONFIG_DIR isolates the registry.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";

const ENV_KEYS = ["GNOSYS_HOME", "GNOSYS_CONFIG_DIR", "HOME", "USERPROFILE"] as const;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe("getProjectRegistryPath isolation", () => {
  it("lives under $GNOSYS_HOME/config when GNOSYS_HOME is set", async () => {
    process.env.GNOSYS_HOME = "/some/isolated/home";
    delete process.env.GNOSYS_CONFIG_DIR;
    const { getProjectRegistryPath } = await import("../lib/paths.js");
    expect(getProjectRegistryPath()).toBe(
      path.join("/some/isolated/home", "config", "projects.json"),
    );
  });

  it("GNOSYS_CONFIG_DIR still wins over GNOSYS_HOME", async () => {
    process.env.GNOSYS_HOME = "/some/isolated/home";
    process.env.GNOSYS_CONFIG_DIR = "/explicit/config";
    const { getProjectRegistryPath } = await import("../lib/paths.js");
    expect(getProjectRegistryPath()).toBe(
      path.join("/explicit/config", "projects.json"),
    );
  });

  it("defaults to ~/.config/gnosys without overrides", async () => {
    delete process.env.GNOSYS_HOME;
    delete process.env.GNOSYS_CONFIG_DIR;
    process.env.HOME = "/Users/someone";
    const { getProjectRegistryPath } = await import("../lib/paths.js");
    expect(getProjectRegistryPath()).toBe(
      path.join("/Users/someone", ".config", "gnosys", "projects.json"),
    );
  });
});

describe("isTempProjectPath", () => {
  it("classifies temp locations", async () => {
    const { isTempProjectPath } = await import("../lib/paths.js");
    expect(isTempProjectPath("/tmp/gnosys-init-test-abc")).toBe(true);
    expect(isTempProjectPath("/private/tmp/x")).toBe(true);
    expect(isTempProjectPath("/var/folders/mj/xyz/T/gnosys-cli-parity-1")).toBe(true);
    expect(isTempProjectPath("/private/var/folders/mj/xyz/T/p")).toBe(true);
    expect(isTempProjectPath(path.join(os.tmpdir(), "anything"))).toBe(true);
    expect(isTempProjectPath("/Users/someone/MSDev/projects/real")).toBe(false);
    expect(isTempProjectPath("/Volumes/Dev/projects/real")).toBe(false);
  });
});

describe("registerProject temp-path guard", () => {
  it("skips temp paths when the registry is the real (non-isolated) one", async () => {
    const fakeHome = await fs.mkdtemp(path.join(os.tmpdir(), "gnosys-reg-guard-"));
    process.env.HOME = fakeHome;
    process.env.USERPROFILE = fakeHome;
    delete process.env.GNOSYS_HOME;
    delete process.env.GNOSYS_CONFIG_DIR;

    const { GnosysResolver } = await import("../lib/resolver.js");
    const resolver = new GnosysResolver();
    await resolver.registerProject(path.join(os.tmpdir(), "gnosys-fake-temp-project"));

    const registryPath = path.join(fakeHome, ".config", "gnosys", "projects.json");
    await expect(fs.readFile(registryPath, "utf-8")).rejects.toThrow();

    // A durable (non-temp) path still registers.
    await resolver.registerProject("/Users/nonexistent-durable-project");
    const raw = await fs.readFile(registryPath, "utf-8");
    expect(JSON.parse(raw)).toEqual([path.resolve("/Users/nonexistent-durable-project")]);

    await fs.rm(fakeHome, { recursive: true, force: true });
  });

  it("allows temp paths when GNOSYS_HOME isolates the registry", async () => {
    const isolatedHome = await fs.mkdtemp(path.join(os.tmpdir(), "gnosys-reg-iso-"));
    process.env.GNOSYS_HOME = isolatedHome;
    delete process.env.GNOSYS_CONFIG_DIR;

    const { GnosysResolver } = await import("../lib/resolver.js");
    const resolver = new GnosysResolver();
    const tempProject = path.join(os.tmpdir(), "gnosys-fake-temp-project-iso");
    await resolver.registerProject(tempProject);

    const registryPath = path.join(isolatedHome, "config", "projects.json");
    const raw = await fs.readFile(registryPath, "utf-8");
    expect(JSON.parse(raw)).toEqual([path.resolve(tempProject)]);

    await fs.rm(isolatedHome, { recursive: true, force: true });
  });
});
