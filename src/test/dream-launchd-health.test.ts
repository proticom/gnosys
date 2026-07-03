/**
 * v5.15: dream LaunchAgent health check. The plist hardcodes absolute node +
 * cli paths, so a Node upgrade silently kills the scheduler. These tests
 * cover the pure plist-parsing seam (parseDreamPlistPaths) against the exact
 * template shape, plus the non-darwin / not-installed branches of
 * checkDreamLaunchAgent. launchctl behavior is deliberately not tested.
 */

import { describe, it, expect } from "vitest";
import {
  parseDreamPlistPaths,
  checkDreamLaunchAgent,
} from "../lib/dreamLaunchd.js";

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

describe("checkDreamLaunchAgent (platform / not-installed branches)", () => {
  it("returns a coherent all-false shape when unavailable or not installed", () => {
    const health = checkDreamLaunchAgent();
    if (process.platform !== "darwin") {
      expect(health).toEqual({
        installed: false,
        loaded: false,
        nodeExists: false,
        cliExists: false,
        healthy: false,
        problems: ["launchd unavailable (not macOS)"],
        plistFile: null,
      });
    } else if (!health.installed) {
      expect(health.healthy).toBe(false);
      expect(health.problems).toContain("launchd agent not installed");
      expect(health.plistFile).toContain("com.gnosys.dream.plist");
    } else {
      // Installed on this machine: healthy must equal the AND of its parts.
      expect(health.healthy).toBe(
        health.loaded && health.nodeExists && health.cliExists,
      );
      expect(health.plistFile).toContain("com.gnosys.dream.plist");
    }
  });
});
