import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { runCli } from "../lib/ideMcpInstall.js";

describe.skipIf(process.platform !== "win32")("Windows batch shim smoke test", () => {
  let testDir: string;
  let savedPath: string | undefined;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys cmd shim "));
    savedPath = process.env.PATH;
  });

  afterEach(() => {
    if (savedPath === undefined) delete process.env.PATH;
    else process.env.PATH = savedPath;
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("preserves spaces in the shim path and arguments", () => {
    const shim = path.join(testDir, "echo-args.cmd");
    fs.writeFileSync(shim, "@echo off\r\necho [%~1]^|[%~2]\r\n", "utf-8");
    process.env.PATH = `${testDir}${path.delimiter}${savedPath ?? ""}`;

    expect(
      runCli("echo-args", ["first argument", "C:\\Program Files\\gnosys\\gnosys-mcp.cmd"]).trim(),
    ).toBe("[first argument]|[C:\\Program Files\\gnosys\\gnosys-mcp.cmd]");
  });
});
