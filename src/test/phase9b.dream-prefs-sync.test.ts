/**
 * Phase 9b: Dream Mode + Preferences + Sync in Sandbox
 * Test Plan Reference: "Phase 9b — Dream Mode + Preferences in Sandbox"
 *
 *   TC-9b.1: Dream Mode idle triggering and state tracking
 *   TC-9b.2: Preference CRUD through sandbox protocol
 *   TC-9b.3: Sync rules generation through sandbox
 *   TC-9b.4: User/global scope memory creation
 *   TC-9b.5: Dream Mode integration with sandbox request handler
 *   TC-9b.6: Rules file injection with protected blocks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import net from "net";
import {
  handleRequest,
  type SandboxRequest,
  initDreamMode,
} from "../sandbox/server.js";
import { z } from "zod";
import type { Preference } from "../lib/preferences.js";
import { injectRules, generateRulesBlock } from "../lib/rulesGen.js";
import { DEFAULT_DREAM_CONFIG, DreamScheduler, GnosysDreamEngine } from "../lib/dream.js";
import { DEFAULT_CONFIG } from "../lib/config.js";
import {
  createTestEnv,
  cleanupTestEnv,
  type TestEnv,
  makeMemory,
} from "./_helpers.js";

let env: TestEnv;

beforeEach(async () => {
  env = await createTestEnv("phase9b");
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  await cleanupTestEnv(env);
});

// ─── TC-9b.1: Dream Mode idle triggering ──────────────────────────────

describe("TC-9b.1: Dream Mode idle triggering and state tracking", () => {
  function seedScheduled(): void {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-11T12:00:00.000Z"));
    vi.stubEnv("GNOSYS_HOME", env.tmpDir);
    env.db.setMeta("machine_id", "sandbox-machine");
    env.db.setDreamMachineId("sandbox-machine");
    env.db.insertMemory(makeMemory({ id: "sandbox-dream", confidence: 0.9, last_reinforced: "2026-01-01T12:00:00.000Z" }));
  }
  const phases = { minMemories: 1, selfCritique: false, generateSummaries: false, discoverRelationships: false };

  it("DreamScheduler starts and stops without error", async () => {
    seedScheduled();
    const scheduler = new DreamScheduler(new GnosysDreamEngine(env.db, DEFAULT_CONFIG, phases), { enabled: true, idleMinutes: 1 });
    try {
      scheduler.start();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(env.db.getMemory("sandbox-dream")?.confidence).toBe(0.86);
      scheduler.stop();
      await vi.advanceTimersByTimeAsync(120_000);
      expect(env.db.queryAuditLog({ operation: "dream_complete" })).toHaveLength(1);
    } finally { scheduler.stop(); }
  });

  it("DreamScheduler recordActivity resets idle timer", async () => {
    seedScheduled();
    const scheduler = new DreamScheduler(new GnosysDreamEngine(env.db, DEFAULT_CONFIG, phases), { enabled: true, idleMinutes: 2 });
    try {
      scheduler.start();
      await vi.advanceTimersByTimeAsync(60_000);
      scheduler.recordActivity();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(env.db.getMemory("sandbox-dream")?.confidence).toBe(0.9);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(env.db.getMemory("sandbox-dream")?.confidence).toBe(0.86);
    } finally { scheduler.stop(); }
  });

  it("initDreamMode creates a scheduler with correct state", async () => {
    seedScheduled();
    const scheduler = initDreamMode(env.db, DEFAULT_CONFIG, { ...phases, idleMinutes: 2 });
    try {
      scheduler?.start();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(env.db.getMemory("sandbox-dream")?.confidence).toBe(0.9);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(env.db.getMemory("sandbox-dream")?.confidence).toBe(0.86);
      expect(handleRequest(env.db, { id: "configured", method: "dream_status", params: {} }).result).toMatchObject({ enabled: true, idleMinutes: 2, isDreaming: false });
    } finally { scheduler?.stop(); }
  });

  it("dream_status returns state through sandbox protocol", () => {
    const scheduler = initDreamMode(env.db, DEFAULT_CONFIG, { idleMinutes: 15 });
    try {
      expect(handleRequest(env.db, { id: "ds1", method: "dream_status", params: {} })).toEqual({
        id: "ds1", ok: true, result: { enabled: true, idleMinutes: 15, lastDreamReport: null, dreamsCompleted: 0, isDreaming: false },
      });
    } finally { scheduler?.stop(); }
  });

  it("Dream engine reports errors when conditions not met", async () => {
    const engine = new GnosysDreamEngine(env.db, DEFAULT_CONFIG, { ...DEFAULT_DREAM_CONFIG, enabled: true, minMemories: 100 });
    const report = await engine.dream();
    expect(report.errors).toEqual(["gnosys.db not available or not migrated"]);
    expect(env.db.queryAuditLog({ operation: "dream_start" })).toEqual([]);
  });
});

// ─── TC-9b.2: Preference CRUD through sandbox ──────────────────────────

describe("TC-9b.2: Preference CRUD through sandbox protocol", () => {
  it("pref_set creates a preference", () => {
    const res = handleRequest(env.db, {
      id: "ps1",
      method: "pref_set",
      params: { key: "commit-convention", value: "conventional commits" },
    });
    expect(res.ok).toBe(true);
    const result = res.result as any;
    expect(result.key).toBe("commit-convention");
    expect(result.value).toBe("conventional commits");
  });

  it("pref_get retrieves a preference", () => {
    // Set first
    handleRequest(env.db, {
      id: "pg1a",
      method: "pref_set",
      params: { key: "code-style", value: "TypeScript strict mode" },
    });

    // Get
    const res = handleRequest(env.db, {
      id: "pg1b",
      method: "pref_get",
      params: { key: "code-style" },
    });
    expect(res.ok).toBe(true);
    expect((res.result as any).value).toBe("TypeScript strict mode");
  });

  it("pref_get returns error for nonexistent preference", () => {
    const res = handleRequest(env.db, {
      id: "pg2",
      method: "pref_get",
      params: { key: "nonexistent-pref" },
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("not found");
  });

  it("pref_list returns all preferences", () => {
    handleRequest(env.db, {
      id: "pl1a",
      method: "pref_set",
      params: { key: "pref-a", value: "value a" },
    });
    handleRequest(env.db, {
      id: "pl1b",
      method: "pref_set",
      params: { key: "pref-b", value: "value b" },
    });

    const res = handleRequest(env.db, {
      id: "pl1c",
      method: "pref_list",
      params: {},
    });
    expect(res.ok).toBe(true);
    expect(z.array(z.object({ key: z.string(), value: z.string() })).parse(res.result).sort((a,b) => a.key.localeCompare(b.key))).toEqual([{ key: "pref-a", value: "value a" }, { key: "pref-b", value: "value b" }]);
  });

  it("pref_delete removes a preference", () => {
    handleRequest(env.db, {
      id: "pd1a",
      method: "pref_set",
      params: { key: "deleteme", value: "temp" },
    });

    const res = handleRequest(env.db, {
      id: "pd1b",
      method: "pref_delete",
      params: { key: "deleteme" },
    });
    expect(res.ok).toBe(true);
    expect((res.result as any).deleted).toBe(true);

    // Verify gone
    const getRes = handleRequest(env.db, {
      id: "pd1c",
      method: "pref_get",
      params: { key: "deleteme" },
    });
    expect(getRes.ok).toBe(false);
  });

  it("pref_set without key returns error", () => {
    const res = handleRequest(env.db, {
      id: "pe1",
      method: "pref_set",
      params: { value: "no key" },
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("required");
  });

  it("preferences are stored as user-scoped memories", () => {
    handleRequest(env.db, {
      id: "pscope1",
      method: "pref_set",
      params: { key: "test-pref-scope", value: "check scope" },
    });

    // Verify the underlying memory has scope: user
    const mem = env.db.getMemory("pref-test-pref-scope");
    expect(mem).not.toBeNull();
    expect(mem?.scope).toBe("user");
    expect(mem?.category).toBe("preferences");
  });
});

// ─── TC-9b.3: Sync rules generation through sandbox ─────────────────────

describe("TC-9b.3: Sync rules generation through sandbox", () => {
  it("sync method generates rules block with preferences", () => {
    // Set up preferences
    handleRequest(env.db, {
      id: "s1a",
      method: "pref_set",
      params: { key: "commit-convention", value: "conventional commits" },
    });
    handleRequest(env.db, {
      id: "s1b",
      method: "pref_set",
      params: { key: "code-style", value: "TypeScript strict" },
    });

    // Call sync
    const res = handleRequest(env.db, {
      id: "s1c",
      method: "sync",
      params: {
        project_dir: env.tmpDir,
        agent_rules_target: "CLAUDE.md",
      },
    });
    expect(res.ok).toBe(true);
    const result = res.result as any;
    expect(result.prefCount).toBe(2);
    expect(result.block).toContain("Gnosys Memory System");
    expect(result.block).toContain("conventional commits");
    expect(result.block).toContain("TypeScript strict");
  });

  it("sync method includes project conventions", () => {
    // Add a project memory (decision)
    handleRequest(env.db, {
      id: "s2a",
      method: "add",
      params: {
        content: "# Use React\n\nWe use React for the frontend.",
        title: "Use React",
        category: "decisions",
        project_id: "proj-sync-test",
        scope: "project",
      },
    });

    const res = handleRequest(env.db, {
      id: "s2b",
      method: "sync",
      params: {
        project_dir: env.tmpDir,
        agent_rules_target: "CLAUDE.md",
        project_id: "proj-sync-test",
      },
    });
    expect(res.ok).toBe(true);
    expect(res.result).toMatchObject({ conventionCount: 1 });
    expect(z.object({ block: z.string() }).parse(res.result).block).toContain("- **Use React**: We use React for the frontend.");
    expect(z.object({ block: z.string() }).parse(res.result).block).toContain("We use React for the frontend.");
  });

  it("sync without project_dir returns error", () => {
    const res = handleRequest(env.db, {
      id: "s3",
      method: "sync",
      params: { agent_rules_target: "CLAUDE.md" },
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("required");
  });
});

// ─── TC-9b.4: User/global scope memory creation ─────────────────────────

describe("TC-9b.4: User/global scope memory creation", () => {
  it("add with scope: user creates user-scoped memory", () => {
    const res = handleRequest(env.db, {
      id: "sc1",
      method: "add",
      params: {
        content: "I prefer dark mode editors",
        title: "Editor preference",
        scope: "user",
      },
    });
    expect(res.ok).toBe(true);
    const memId = (res.result as any).id;

    const mem = env.db.getMemory(memId);
    expect(mem?.scope).toBe("user");
  });

  it("add with scope: global creates global-scoped memory", () => {
    const res = handleRequest(env.db, {
      id: "sc2",
      method: "add",
      params: {
        content: "REST APIs should use consistent naming",
        title: "API naming convention",
        scope: "global",
      },
    });
    expect(res.ok).toBe(true);
    const memId = (res.result as any).id;

    const mem = env.db.getMemory(memId);
    expect(mem?.scope).toBe("global");
  });

  it("add defaults to scope: project", () => {
    const res = handleRequest(env.db, {
      id: "sc3",
      method: "add",
      params: { content: "Default scope test" },
    });
    expect(res.ok).toBe(true);
    const memId = (res.result as any).id;

    const mem = env.db.getMemory(memId);
    expect(mem?.scope).toBe("project");
  });
});

// ─── TC-9b.5: Dream Mode + sandbox request handler integration ──────────

describe("TC-9b.5: Dream Mode integration with sandbox request handler", () => {
  let server: net.Server;
  let socketPath: string;

  beforeEach(async () => {
    socketPath = path.join(env.tmpDir, "dream-test.sock");
    server = net.createServer((socket) => {
      let buffer = "";
      socket.on("data", (data) => {
        buffer += data.toString();
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          try {
            const req = JSON.parse(line) as SandboxRequest;
            const res = handleRequest(env.db, req);
            socket.write(JSON.stringify(res) + "\n");
          } catch { /* skip */ }
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(socketPath, resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try { fs.unlinkSync(socketPath); } catch { /* ignore */ }
  });

  function request(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(socketPath, () => socket.write(JSON.stringify({ id: "wire-1", method, params }) + "\n"));
      let body = "";
      socket.on("error", reject);
      socket.on("data", data => {
        body += data;
        if (body.includes("\n")) {
          socket.end();
          try { resolve(JSON.parse(body.trim())); } catch (error) { reject(error); }
        }
      });
    });
  }

  it("wire client can check configured dream status", async () => {
    const scheduler = initDreamMode(env.db, DEFAULT_CONFIG, { idleMinutes: 7 });
    try {
      expect(await request("dream_status")).toEqual({ id: "wire-1", ok: true, result: { enabled: true, idleMinutes: 7, lastDreamReport: null, dreamsCompleted: 0, isDreaming: false } });
    } finally { scheduler?.stop(); }
  });

  it("wire client can set and list persisted preferences", async () => {
    expect(await request("pref_set", { key: "testing-approach", value: "vitest with coverage" })).toMatchObject({ ok: true, result: { key: "testing-approach", value: "vitest with coverage" } });
    expect(await request("pref_list")).toMatchObject({ ok: true, result: [{ key: "testing-approach", value: "vitest with coverage" }] });
    expect(env.db.getMemory("pref-testing-approach")).toMatchObject({ scope: "user", content: "# Testing Approach\n\nvitest with coverage" });
  });
});

// ─── TC-9b.6: Rules file injection with protected blocks ────────────────

describe("TC-9b.6: Rules file injection with protected blocks", () => {
  it("injectRules creates new file with GNOSYS markers", async () => {
    const filePath = path.join(env.tmpDir, "CLAUDE.md");
    const block = generateRulesBlock([], []);

    await injectRules(filePath, block);

    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toContain("<!-- GNOSYS:START -->");
    expect(content).toContain("<!-- GNOSYS:END -->");
    expect(content).toContain("Gnosys Memory System");
  });

  it("injectRules preserves content outside GNOSYS block", async () => {
    const filePath = path.join(env.tmpDir, "CLAUDE.md");
    const userContent = "# My Custom Instructions\n\nThis is my custom content.\n\n";
    fs.writeFileSync(filePath, userContent);

    const block = generateRulesBlock([], []);
    await injectRules(filePath, block);

    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toContain("# My Custom Instructions");
    expect(content).toContain("This is my custom content.");
    expect(content).toContain("<!-- GNOSYS:START -->");
  });

  it("injectRules replaces existing GNOSYS block", async () => {
    const filePath = path.join(env.tmpDir, "CLAUDE.md");

    // First injection
    const block1 = generateRulesBlock(
      [{ key: "k1", value: "first version", title: "K1", tags: [], confidence: 0.9, created: "2026-03-12", modified: "2026-03-12" }],
      []
    );
    await injectRules(filePath, block1);

    // Second injection with different content
    const block2 = generateRulesBlock(
      [{ key: "k2", value: "second version", title: "K2", tags: [], confidence: 0.9, created: "2026-03-12", modified: "2026-03-12" }],
      []
    );
    await injectRules(filePath, block2);

    const content = fs.readFileSync(filePath, "utf8");
    // Should have block2 content, not block1
    expect(content).toContain("second version");
    expect(content).not.toContain("first version");
    // Should only have ONE pair of markers
    const startCount = (content.match(/<!-- GNOSYS:START -->/g) || []).length;
    expect(startCount).toBe(1);
  });

  it("injectRules with preferences includes preference content", async () => {
    const filePath = path.join(env.tmpDir, "rules.mdc");

    const prefs: Preference[] = [
      { key: "commit-convention", value: "conventional commits", title: "Commit Convention", tags: [], confidence: 0.9, created: "2026-03-12", modified: "2026-03-12" },
      { key: "code-style", value: "TypeScript strict", title: "Code Style", tags: [], confidence: 0.9, created: "2026-03-12", modified: "2026-03-12" },
    ];
    const block = generateRulesBlock(prefs, []);
    await injectRules(filePath, block);

    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toContain("User preferences");
    expect(content).toContain("conventional commits");
    expect(content).toContain("TypeScript strict");
  });
});
