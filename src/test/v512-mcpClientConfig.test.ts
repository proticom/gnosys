/**
 * v5.12 Phase B — client config: point an IDE at a remote gnosys server.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import {
  remoteMcpEntry,
  writeCursorRemote,
  mergeJsonMcpServer,
} from "../lib/mcpClientConfig.js";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-client-"));
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("v5.12 remoteMcpEntry", () => {
  it("returns a url entry without a token", () => {
    expect(remoteMcpEntry({ url: "http://host:7777/mcp" })).toEqual({ url: "http://host:7777/mcp" });
  });

  it("includes a bearer header when a token is given", () => {
    expect(remoteMcpEntry({ url: "http://host:7777/mcp", token: "abc" })).toEqual({
      url: "http://host:7777/mcp",
      headers: { Authorization: "Bearer abc" },
    });
  });
});

describe("v5.12 writeCursorRemote", () => {
  it("writes .cursor/mcp.json pointing gnosys at the URL", async () => {
    const file = await writeCursorRemote(dir, { url: "http://studio:7777/mcp", token: "t0ken" });
    expect(file).toBe(path.join(dir, ".cursor", "mcp.json"));
    const cfg = JSON.parse(await fsp.readFile(file, "utf-8"));
    expect(cfg.mcpServers.gnosys).toEqual({
      url: "http://studio:7777/mcp",
      headers: { Authorization: "Bearer t0ken" },
    });
  });

  it("merges with an existing mcpServers map (preserves other servers)", async () => {
    const file = path.join(dir, ".cursor", "mcp.json");
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, JSON.stringify({ mcpServers: { other: { command: "x" } } }), "utf-8");

    await writeCursorRemote(dir, { url: "http://studio:7777/mcp" });
    const cfg = JSON.parse(await fsp.readFile(file, "utf-8"));
    expect(cfg.mcpServers.other).toEqual({ command: "x" });
    expect(cfg.mcpServers.gnosys).toEqual({ url: "http://studio:7777/mcp" });
  });

  it("accepts a UTF-8 BOM and preserves the existing configuration", async () => {
    const file = path.join(dir, ".cursor", "mcp.json");
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(
      file,
      `\uFEFF${JSON.stringify({
        theme: "dark",
        mcpServers: { other: { command: "other-mcp", args: ["--safe"] } },
      })}`,
      "utf-8",
    );

    await mergeJsonMcpServer(file, { url: "http://studio:7777/mcp" });

    const raw = await fsp.readFile(file, "utf-8");
    expect(raw.startsWith("\uFEFF")).toBe(false);
    const cfg = JSON.parse(raw);
    expect(cfg.theme).toBe("dark");
    expect(cfg.mcpServers.other).toEqual({ command: "other-mcp", args: ["--safe"] });
    expect(cfg.mcpServers.gnosys).toEqual({ url: "http://studio:7777/mcp" });
  });

  it("refuses invalid existing JSON without clobbering it", async () => {
    const file = path.join(dir, ".cursor", "mcp.json");
    const invalid = '{"mcpServers":{"other":{"command":"x"}}';
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, invalid, "utf-8");

    await expect(mergeJsonMcpServer(file, { url: "http://studio:7777/mcp" })).rejects.toThrow(
      new RegExp(`Invalid JSON.*${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    );
    expect(await fsp.readFile(file)).toEqual(Buffer.from(invalid, "utf-8"));
  });

  it.each([
    ["a non-object root", "[]"],
    ["a non-object mcpServers value", '{"untouched":true,"mcpServers":[]}'],
  ])("refuses %s without clobbering it", async (_case, contents) => {
    const file = path.join(dir, ".cursor", "mcp.json");
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, contents, "utf-8");

    await expect(mergeJsonMcpServer(file, { url: "http://studio:7777/mcp" })).rejects.toThrow(
      new RegExp(`Invalid MCP config.*${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    );
    expect(await fsp.readFile(file)).toEqual(Buffer.from(contents, "utf-8"));
  });

  it("does not trust a successful write until the entry is read back and verified", async () => {
    const file = path.join(dir, ".cursor", "mcp.json");
    const original = JSON.stringify({ mcpServers: { other: { command: "x" } } });
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, original, "utf-8");
    vi.spyOn(fsp, "writeFile").mockResolvedValueOnce();

    await expect(
      mergeJsonMcpServer(file, {
        url: "http://studio:7777/mcp",
        headers: { Authorization: "Bearer nested-value" },
      }),
    ).rejects.toThrow(/Could not verify MCP config.*mcpServers\.gnosys.*does not match/);
    expect(await fsp.readFile(file, "utf-8")).toBe(original);
  });

  it("propagates existing-file read failures instead of starting fresh", async () => {
    const file = path.join(dir, ".cursor", "mcp.json");
    const denied = Object.assign(new Error(`EACCES: permission denied, open '${file}'`), {
      code: "EACCES",
    });
    vi.spyOn(fsp, "readFile").mockRejectedValueOnce(denied);
    const write = vi.spyOn(fsp, "writeFile");

    await expect(mergeJsonMcpServer(file, { url: "http://studio:7777/mcp" })).rejects.toBe(denied);
    expect(write).not.toHaveBeenCalled();
  });

  it("mergeJsonMcpServer creates the file fresh when absent", async () => {
    const file = path.join(dir, "nested", "mcp.json");
    await mergeJsonMcpServer(file, remoteMcpEntry({ url: "http://h/mcp" }));
    const cfg = JSON.parse(await fsp.readFile(file, "utf-8"));
    expect(cfg.mcpServers.gnosys.url).toBe("http://h/mcp");
  });
});
