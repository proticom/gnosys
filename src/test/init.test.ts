import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import { GnosysDB } from "../lib/db.js";

let tmpDir: string;

// Per-test isolated central DB path. Without this, every `gnosys init` call
// would register the temp project in the user's real ~/.gnosys/gnosys.db.
function gnosysInit(opts: { capture?: boolean } = {}): string {
  return execSync(`node "${path.resolve("dist/cli.js")}" init --directory "${tmpDir}"`, {
    encoding: "utf-8",
    stdio: opts.capture ? "pipe" : ["pipe", "pipe", "pipe"],
    env: { ...process.env, GNOSYS_HOME: path.join(tmpDir, ".test-central") },
  });
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gnosys-init-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("gnosys init", () => {
  it("creates a usable registered store without legacy artifacts", async () => {
    gnosysInit();
    const storePath = path.join(tmpDir, ".gnosys");
    expect((await fs.readdir(storePath)).sort()).toEqual([
      ".config", ".gitignore", "attachments", "gnosys.json",
    ]);
    expect((await fs.readdir(path.join(storePath, ".config"))).sort()).toEqual([
      "gnosys-config.json", "tags.json",
    ]);
    expect(JSON.parse(await fs.readFile(path.join(storePath, "attachments/attachments.json"), "utf8")))
      .toEqual({ attachments: [] });
    const identity = JSON.parse(await fs.readFile(path.join(storePath, "gnosys.json"), "utf8"));
    expect(identity.projectId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(identity).toMatchObject({ projectName: path.basename(tmpDir), workingDirectory: tmpDir, schemaVersion: 1 });
    const db = new GnosysDB(path.join(tmpDir, ".test-central"));
    try {
      expect(db.getProject(identity.projectId)).toMatchObject({ name: path.basename(tmpDir), working_directory: tmpDir });
    } finally {
      db.close();
    }
  });

  it("writes the default categorized tag registry", async () => {
    gnosysInit();
    const tags = JSON.parse(await fs.readFile(path.join(tmpDir, ".gnosys/.config/tags.json"), "utf8"));
    expect(tags).toEqual({
      domain: ["architecture", "api", "auth", "database", "devops", "frontend", "backend", "testing", "security", "performance"],
      type: ["decision", "concept", "convention", "requirement", "observation", "fact", "question"],
      concern: ["dx", "scalability", "maintainability", "reliability"],
      status_tag: ["draft", "stable", "deprecated", "experimental"],
    });
  });

  it("re-syncs the working directory while retaining a valid project ID", async () => {
    gnosysInit();
    const identityPath = path.join(tmpDir, ".gnosys/gnosys.json");
    const identity = JSON.parse(await fs.readFile(identityPath, "utf8"));
    expect(identity.projectId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    await fs.writeFile(identityPath, JSON.stringify({ ...identity, workingDirectory: "/previous/location" }));
    expect(gnosysInit({ capture: true })).toContain("re-synced");
    expect(JSON.parse(await fs.readFile(identityPath, "utf8"))).toMatchObject({
      projectId: identity.projectId,
      workingDirectory: tmpDir,
    });
  });

  it("outputs helpful instructions", () => {
    const output = gnosysInit({ capture: true });
    expect(output).toContain("Gnosys store");
    expect(output).toContain("gnosys add");
  });
});
