import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
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

  it("uses identical semver regexes in the generator and runtime validator", () => {
    const runtime = readFileSync(new URL("../lib/version.ts", import.meta.url), "utf8");
    const script = readFileSync(SYNC_SCRIPT, "utf8");
    const pattern = /^const SEMVER = (\/.+\/);$/m;
    const runtimeRegex = runtime.match(pattern)?.[1];
    expect(typeof runtimeRegex).toBe("string");
    expect(script.match(pattern)?.[1]).toBe(runtimeRegex);
  });

  describe.each([false, true])("invalid package version with existing module %s", (existing) => {
    it.each(["banana", "v7.0.0", "7.0.0-01", "7.0.0\n", null, 7, undefined])(
      "rejects %s before writing the embedded module",
      (version) => {
        const root = join(tempHome, "package");
        mkdirSync(root);
        writeFileSync(join(root, "package.json"), JSON.stringify({ version }));
        const generated = join(root, "src", "version.ts");
        const original = Buffer.from('// existing embedded version\r\nexport const GNOSYS_VERSION = "7.0.0";\r\n');
        if (existing) {
          mkdirSync(join(root, "src"));
          writeFileSync(generated, original);
        }

        const result = spawnSync(process.execPath, [SYNC_SCRIPT, root], {
          cwd: tempHome,
          env: { ...process.env, HOME: tempHome, GNOSYS_HOME: join(tempHome, "brain") },
          encoding: "utf8",
          timeout: 10_000,
        });

        expect(result.status).toBe(1);
        expect(result.stderr).toBe(`gnosys: package.json version ${JSON.stringify(version)} is not valid semver\n`);
        if (existing) {
          expect(readFileSync(generated)).toEqual(original);
        } else {
          expect(existsSync(generated)).toBe(false);
        }
      },
    );
  });

  describe("locked-in rejections (PR #93 QA)", () => {
    describe.each([false, true])(
      "with existing embedded module %s",
      (existing) => {
        it.each(["7.0", "", " \t\n ", "01.0.0", "7.0.0-"])(
          "rejects %j at runtime and in the generator",
          (version) => {
            expect(() => validateGnosysVersion(version)).toThrow(
              new Error(
                "gnosys: embedded version missing or invalid; " +
                "rebuild the package",
              ),
            );

            const root = join(tempHome, "package");
            mkdirSync(root);
            writeFileSync(
              join(root, "package.json"),
              JSON.stringify({ version }),
            );
            const generated = join(root, "src", "version.ts");
            const original = Buffer.from(
              'export const GNOSYS_VERSION = "7.0.0";\r\n',
            );
            if (existing) {
              mkdirSync(join(root, "src"));
              writeFileSync(generated, original);
            }

            const result = spawnSync(process.execPath, [SYNC_SCRIPT, root], {
              cwd: tempHome,
              env: {
                ...process.env,
                HOME: tempHome,
                GNOSYS_HOME: join(tempHome, "brain"),
              },
              encoding: "utf8",
              timeout: 10_000,
            });

            expect(result.status).toBe(1);
            expect(result.stderr).toBe(
              `gnosys: package.json version ${JSON.stringify(version)}` +
              " is not valid semver\n",
            );
            if (existing) {
              expect(readFileSync(generated)).toEqual(original);
            } else {
              expect(existsSync(generated)).toBe(false);
            }
          },
        );
      },
    );
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
