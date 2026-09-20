import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMemoryWithOverlay, type ResolvedClientRead } from "../lib/clientReadResolve.js";
import { defaultMachineConfig, writeMachineConfig } from "../lib/machineConfig.js";
import { GnosysDB } from "../lib/db.js";
import { GnosysResolver } from "../lib/resolver.js";
import { GnosysStore } from "../lib/store.js";
import { runReadCommand } from "../lib/readCommand.js";
import type { PendingAddRow } from "../lib/clientReadOverlay.js";

let home: string;
let db: GnosysDB;
const pendingRow: PendingAddRow = {
  id: "01PENDING", title: "Pending offline add", category: "concepts",
  content: "written while master was unreachable", tags: "[]", project_id: null,
  scope: "global", created: "2026-06-11T00:00:00.000Z",
};

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "gnosys-read-overlay-"));
  vi.stubEnv("GNOSYS_HOME", path.join(home, "brain"));
  vi.stubEnv("GNOSYS_CONFIG_DIR", path.join(home, "config"));
  db = GnosysDB.openCentral();
});

afterEach(async () => {
  db.close();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await fs.rm(home, { recursive: true, force: true });
});

function makeResolved(pendingOverlay: PendingAddRow[]): ResolvedClientRead {
  return { db, localDb: db, pendingOverlay, clientRead: null, release: () => {} };
}

async function read(memoryPath: string): Promise<string> {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  await runReadCommand(() => GnosysResolver.resolveForProject(home), memoryPath, { json: true });
  return log.mock.calls.map(args => args.join(" ")).join("\n");
}

describe("gnosys read command overlay wiring", () => {
  it("routes read-by-id through the client read overlay like its siblings", async () => {
    const machine = defaultMachineConfig();
    machine.remote = { enabled: true, role: "client", path: path.join(home, "offline-master") };
    writeMachineConfig(machine);
    db.insertPendingAdd(pendingRow);
    const result = JSON.parse(await read("01PENDING"));
    expect(result).toMatchObject({ path: "01PENDING", source: "gnosys.db", memory: {
      id: "01PENDING", title: "Pending offline add", content: "written while master was unreachable", scope: "global", status: "active",
    } });
    expect(result.content).toContain("written while master was unreachable");
    expect(db.getMemory("01PENDING")).toBeNull();
  });

  it("keeps the legacy resolver fallback for markdown stores", async () => {
    const store = new GnosysStore(path.join(home, ".gnosys"));
    await store.init();
    const dir = path.join(home, ".gnosys", "concepts");
    await fs.mkdir(dir, { recursive: true });
    const raw = "---\nid: legacy-read\ntitle: Legacy document\ncategory: concepts\nstatus: active\n---\n\n# Legacy body\n";
    await fs.writeFile(path.join(dir, "legacy.md"), raw);
    const result = JSON.parse(await read("concepts/legacy.md"));
    expect(result).toMatchObject({ path: "concepts/legacy.md", content: raw });
    expect(result.source).toBe("project");
  });
});

describe("getMemoryWithOverlay", () => {
  it("falls back to the pending overlay when the DB misses", () => {
    expect(getMemoryWithOverlay(makeResolved([pendingRow]), "01PENDING")).toMatchObject({
      id: "01PENDING", title: "Pending offline add", status: "active",
      content: "written while master was unreachable", attachment_data: null, attachment_mime: null, attachment_name: null,
    });
  });

  it("returns null when neither DB nor overlay has the id", () => {
    expect(getMemoryWithOverlay(makeResolved([pendingRow]), "01MISSING")).toBeNull();
    expect(getMemoryWithOverlay(makeResolved([]), "01PENDING")).toBeNull();
  });
});
