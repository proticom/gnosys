/**
 * v5.15: dream LaunchAgent health check. The plist hardcodes absolute node +
 * cli paths, so a Node upgrade silently kills the scheduler. These tests
 * cover the pure plist-parsing seam (parseDreamPlistPaths) against the exact
 * template shape, plus the non-darwin / not-installed branches of
 * checkDreamLaunchAgent. launchctl behavior is deliberately not tested.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { describe, it, expect, vi } from "vitest";
import {
  parseDreamPlistPaths,
  checkDreamLaunchAgent,
} from "../lib/dreamLaunchd.js";

vi.mock("child_process", () => ({ execFileSync: vi.fn() }));

const TEMPLATE_BODY = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.gnosys.dream</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/edward/.nvm/versions/node/v22.17.1/bin/node</string>
    <string>/Users/edward/.nvm/versions/node/v22.17.1/bin/gnosys</string>
    <string>dream</string>
    <string>run</string>
    <string>--scheduled</string>
  </array>
  <key>StandardOutPath</key>
  <string>/tmp/gnosys-dream.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/gnosys-dream.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>/Users/edward</string>
    <key>PATH</key>
    <string>/Users/edward/.nvm/versions/node/v22.17.1/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
`;

describe("parseDreamPlistPaths", () => {
  it("extracts node + cli paths from the exact template shape", () => {
    const { nodePath, cliPath } = parseDreamPlistPaths(TEMPLATE_BODY);
    expect(nodePath).toBe("/Users/edward/.nvm/versions/node/v22.17.1/bin/node");
    expect(cliPath).toBe("/Users/edward/.nvm/versions/node/v22.17.1/bin/gnosys");
  });

  it("unescapes XML entities in paths", () => {
    const body = `<string>label</string><string>/opt/a&amp;b/node</string><string>/opt/&quot;q&quot;/gnosys</string>`;
    const { nodePath, cliPath } = parseDreamPlistPaths(body);
    expect(nodePath).toBe("/opt/a&b/node");
    expect(cliPath).toBe('/opt/"q"/gnosys');
  });

  it("returns undefined paths for an empty or truncated body", () => {
    expect(parseDreamPlistPaths("")).toEqual({
      nodePath: undefined,
      cliPath: undefined,
    });
    expect(parseDreamPlistPaths("<string>only-label</string>")).toEqual({
      nodePath: undefined,
      cliPath: undefined,
    });
  });
});

describe("checkDreamLaunchAgent", () => {
  it("reports missing, healthy, and broken installed agents in an isolated home", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-launch-health-"));
    const home = vi.spyOn(os, "homedir").mockReturnValue(tmp);
    const platform = process.platform;
    Object.defineProperty(process, "platform", { value: "darwin" });
    try {
      const plistFile = path.join(tmp, "Library/LaunchAgents/com.gnosys.dream.plist");
      expect(checkDreamLaunchAgent()).toEqual({
        installed: false, loaded: false, nodeExists: false, cliExists: false, healthy: false,
        problems: ["launchd agent not installed"], plistFile,
      });
      const node = path.join(tmp, "node");
      const cli = path.join(tmp, "gnosys");
      fs.writeFileSync(node, "node fixture");
      fs.writeFileSync(cli, "cli fixture");
      fs.mkdirSync(path.dirname(plistFile), { recursive: true });
      fs.writeFileSync(plistFile, `<plist><dict><string>com.gnosys.dream</string><array><string>${node}</string><string>${cli}</string></array></dict></plist>`);
      expect(checkDreamLaunchAgent()).toEqual({
        installed: true, loaded: true, nodeExists: true, cliExists: true, healthy: true,
        problems: [], plistFile,
      });
      fs.unlinkSync(cli);
      expect(checkDreamLaunchAgent()).toEqual({
        installed: true, loaded: true, nodeExists: true, cliExists: false, healthy: false,
        problems: [`gnosys cli missing at ${cli}`], plistFile,
      });
      Object.defineProperty(process, "platform", { value: "linux" });
      expect(checkDreamLaunchAgent()).toEqual({
        installed: false, loaded: false, nodeExists: false, cliExists: false, healthy: false,
        problems: ["launchd unavailable (not macOS)"], plistFile: null,
      });
    } finally {
      Object.defineProperty(process, "platform", { value: platform });
      home.mockRestore();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
