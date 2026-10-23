import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getGnosysVersion, validateGnosysVersion } from "../lib/version.js";
import { GNOSYS_VERSION } from "../version.js";

const PACKAGE_JSON = new URL("../../package.json", import.meta.url);
const SYNC_SCRIPT = fileURLToPath(new URL("../../scripts/sync-version.mjs", import.meta.url));

describe("embedded Gnosys version", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "gnosys-version-"));
    vi.stubEnv("HOME", tempHome);
    vi.stubEnv("GNOSYS_HOME", join(tempHome, "brain"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(tempHome, { recursive: true, force: true });
  });

  it("matches package.json so an unsynced version bump fails", () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8"));
    expect(GNOSYS_VERSION).toBe(pkg.version);
    expect(getGnosysVersion()).toBe(pkg.version);
  });

  it("generates a deterministic module in a supplied package root without rewriting unchanged content", () => {
    const root = join(tempHome, "package with spaces");
    mkdirSync(root);
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: "12.34.56-rc.1+build.007" }));
    const runSync = () => execFileSync(process.execPath, [SYNC_SCRIPT, root], {
      cwd: tempHome,
      env: { ...process.env, HOME: tempHome, GNOSYS_HOME: join(tempHome, "brain") },
      timeout: 10_000,
    });
    const generated = join(root, "src", "version.ts");
    const expected = '// generated - do not edit; run npm run sync-version\nexport const GNOSYS_VERSION = "12.34.56-rc.1+build.007";\n';

    runSync();
    expect(readFileSync(generated, "utf8")).toBe(expected);

    const timestamp = new Date("2000-01-01T00:00:00Z");
    utimesSync(generated, timestamp, timestamp);
    runSync();
    expect(readFileSync(generated, "utf8")).toBe(expected);
    expect(statSync(generated).mtimeMs).toBe(timestamp.getTime());

    writeFileSync(join(root, "package.json"), JSON.stringify({ version: "12.34.57" }));
    runSync();
    expect(readFileSync(generated, "utf8")).toBe(
      '// generated - do not edit; run npm run sync-version\nexport const GNOSYS_VERSION = "12.34.57";\n',
    );
  });

  it.each([
    "0.0.0",
    "7.0.0",
    "7.0.0-0",
    "7.0.0-rc.1",
    "7.0.0-01alpha",
    "7.0.0+build.007",
    "7.0.0-rc.1+build.007",
  ])("accepts valid semver %s", (version) => {
    expect(validateGnosysVersion(version)).toBe(version);
  });

  it.each([
    "",
    "invalid",
    "7",
    "7.0",
    "v7.0.0",
    "07.0.0",
    "7.00.0",
    "7.0.00",
    "7.0.0-01",
    "7.0.0-rc.01",
    "7.0.0-",
    "7.0.0-rc..1",
    "7.0.0+",
    "7.0.0+build..1",
    "7.0.0+build_1",
    " 7.0.0",
    "7.0.0 ",
    "7.0.0\n",
    undefined,
    null,
    7,
  ])("rejects a missing or invalid embedded value %s", (version) => {
    expect(() => validateGnosysVersion(version)).toThrow(
      new Error("gnosys: embedded version missing or invalid; rebuild the package"),
    );
  });
});
