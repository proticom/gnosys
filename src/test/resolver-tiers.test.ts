/**
 * Tests for cross-project tier loading in resolveForProject().
 *
 * Regression for the bug where passing `projectRoot` (which every MCP tool is
 * told to always do) produced a resolver with ONLY the project store — so
 * `store: "global"` / `"personal"` writes failed with "No writable store
 * found", and global/personal memories were unreadable from any project.
 * resolveForProject must load the personal/global/optional env tiers too, and
 * the global tier must auto-init even when its directory does not pre-exist
 * (parity with personal).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";
import { GnosysResolver } from "../lib/resolver.js";
import { GnosysStore } from "../lib/store.js";

function tmp(prefix: string): string {
  return path.join(os.tmpdir(), `gnosys-test-${prefix}-${crypto.randomBytes(6).toString("hex")}`);
}

describe("resolveForProject cross-project tiers", () => {
  let projectDir: string;
  let personalDir: string;
  let globalDir: string;
  let origPersonal: string | undefined;
  let origGlobal: string | undefined;

  beforeEach(async () => {
    origPersonal = process.env.GNOSYS_PERSONAL;
    origGlobal = process.env.GNOSYS_GLOBAL;

    projectDir = tmp("proj");
    fs.mkdirSync(path.join(projectDir, ".gnosys"), { recursive: true });
    const store = new GnosysStore(path.join(projectDir, ".gnosys"));
    await store.init();

    personalDir = tmp("personal");
    fs.mkdirSync(personalDir, { recursive: true });
    process.env.GNOSYS_PERSONAL = personalDir;

    // Deliberately do NOT create globalDir — the resolver must create it on
    // demand (this mirrors a configured-but-empty GNOSYS_GLOBAL).
    globalDir = tmp("global");
    process.env.GNOSYS_GLOBAL = globalDir;
  });

  afterEach(async () => {
    if (origPersonal === undefined) delete process.env.GNOSYS_PERSONAL;
    else process.env.GNOSYS_PERSONAL = origPersonal;
    if (origGlobal === undefined) delete process.env.GNOSYS_GLOBAL;
    else process.env.GNOSYS_GLOBAL = origGlobal;

    await fsp.rm(projectDir, { recursive: true, force: true });
    await fsp.rm(personalDir, { recursive: true, force: true });
    await fsp.rm(globalDir, { recursive: true, force: true });
  });

  it("loads project + personal + global tiers when scoped to a projectRoot", async () => {
    const resolver = await GnosysResolver.resolveForProject(projectDir);
    const layers = resolver.getStores().map((s) => s.layer);
    expect(layers).toContain("project");
    expect(layers).toContain("personal");
    expect(layers).toContain("global");
  });

  it("getWriteTarget('global') resolves under a projectRoot (the reported bug)", async () => {
    const resolver = await GnosysResolver.resolveForProject(projectDir);
    const target = resolver.getWriteTarget("global");
    expect(target).not.toBeNull();
    expect(target!.writable).toBe(true);
    expect(target!.layer).toBe("global");
  });

  it("auto-creates the global store directory when it does not pre-exist", async () => {
    expect(fs.existsSync(globalDir)).toBe(false);
    const resolver = await GnosysResolver.resolveForProject(projectDir);
    expect(resolver.getWriteTarget("global")).not.toBeNull();
    // store.init() should have materialized the directory.
    expect(fs.existsSync(globalDir)).toBe(true);
  });

  it("still defaults writes to project (global is never auto-selected)", async () => {
    const resolver = await GnosysResolver.resolveForProject(projectDir);
    const target = resolver.getWriteTarget();
    expect(target).not.toBeNull();
    expect(target!.layer).toBe("project");
  });

  it("falls back to personal as the write target when no project store exists", async () => {
    const noStoreDir = tmp("nostore");
    fs.mkdirSync(noStoreDir, { recursive: true });
    try {
      const resolver = await GnosysResolver.resolveForProject(noStoreDir);
      const target = resolver.getWriteTarget();
      expect(target).not.toBeNull();
      expect(target!.layer).toBe("personal");
    } finally {
      await fsp.rm(noStoreDir, { recursive: true, force: true });
    }
  });
});
