import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import { extractJson } from "./_helpers.js";

let tmpDir: string;
let centralDir: string;

// Test-isolated env for every CLI invocation. Without GNOSYS_HOME, the CLI
// would write to ~/.gnosys/gnosys.db and pollute the user's real DB.
function testEnv() {
  return { ...process.env, GNOSYS_HOME: centralDir };
}

const CLI_BIN = `node "${path.resolve("dist/cli.js")}"`;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "gnosys-json-test-"));
  centralDir = path.join(tmpDir, ".test-central");
  // Init a store so commands have something to work with
  execSync(`${CLI_BIN} init --directory "${tmpDir}"`, {
    stdio: "pipe",
    cwd: tmpDir,
    env: testEnv(),
  });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("CLI --json flag", () => {
  it("gnosys list --json outputs valid JSON", () => {
    execSync(`${CLI_BIN} pref set json-list "Listed preference"`, { stdio: "pipe", cwd: tmpDir, env: testEnv() });
    const output = execSync(`${CLI_BIN} list --json`, {
      encoding: "utf-8",
      cwd: tmpDir,
      env: testEnv(),
    });
    const parsed = JSON.parse(extractJson(output));
    expect(parsed).toEqual({ count: 1, memories: [{
      id: "pref-json-list", title: "Json List", category: "preferences", status: "active",
      scope: "user", confidence: 0.95, project: null,
    }] });
  });

  it("gnosys stats --json outputs valid JSON", () => {
    const output = execSync(`${CLI_BIN} stats --json`, {
      encoding: "utf-8",
      cwd: tmpDir,
      env: testEnv(),
    });
    const parsed = JSON.parse(extractJson(output));
    expect(parsed).toEqual({ totalCount: 0 });
    execSync(`${CLI_BIN} pref set stats-key "Counted value"`, { stdio: "pipe", cwd: tmpDir, env: testEnv() });
    const populated = JSON.parse(extractJson(execSync(`${CLI_BIN} stats --json`, { encoding: "utf8", cwd: tmpDir, env: testEnv() })));
    expect(populated).toMatchObject({ totalCount: 1, byCategory: { preferences: 1 }, byStatus: { active: 1 }, byAuthor: { human: 1 } });
  });

  it("gnosys projects --json outputs valid JSON", () => {
    const output = execSync(`${CLI_BIN} projects --json`, {
      encoding: "utf-8",
      cwd: tmpDir,
      env: testEnv(),
    });
    const parsed = JSON.parse(extractJson(output));
    expect(parsed).toMatchObject({ count: 1, totalRegistered: 1, deadCount: 0 });
    expect(parsed.projects.map((project: { name: string; working_directory: string; memoryCount: number }) => ({
      name: project.name, directory: project.working_directory, memories: project.memoryCount,
    }))).toEqual([{ name: path.basename(tmpDir), directory: tmpDir, memories: 0 }]);
  });

  it("gnosys pref get --json outputs valid JSON with no prefs", () => {
    const output = execSync(`${CLI_BIN} pref get --json`, {
      encoding: "utf-8",
      cwd: tmpDir,
      env: testEnv(),
    });
    const parsed = JSON.parse(extractJson(output));
    expect(parsed).toEqual({ preferences: [] });
  });

  it("gnosys pref set + get --json round-trips", () => {
    execSync(`${CLI_BIN} pref set test-key "test value"`, {
      stdio: "pipe",
      cwd: tmpDir,
      env: testEnv(),
    });

    const output = execSync(`${CLI_BIN} pref get test-key --json`, {
      encoding: "utf-8",
      cwd: tmpDir,
      env: testEnv(),
    });
    const parsed = JSON.parse(extractJson(output));
    expect(parsed.key).toBe("test-key");
    expect(parsed.value).toBe("test value");

    // Cleanup
    execSync(`${CLI_BIN} pref delete test-key`, {
      stdio: "pipe",
      cwd: tmpDir,
      env: testEnv(),
    });
  });
});
