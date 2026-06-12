/**
 * v5.12.1 — central ToolContext release (MCP resource-leak fix).
 *
 * Before this fix only 8 of 52 tool handlers released the v13 clientRead
 * context (owned DB handle) — every other handler leaked it on early returns
 * and errors. The fix enforces release centrally: resolveToolContext()
 * registers each context in a per-call AsyncLocalStorage store, and regTool
 * wraps every handler in withContextRelease() which releases all registered
 * contexts when the handler settles.
 *
 * These are marker tests on src/index.ts (same idiom as the command-handler
 * wiring tests): they pin the invariant so a refactor cannot silently drop it.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("MCP central ToolContext release", () => {
  const src = readFileSync(join(process.cwd(), "src/index.ts"), "utf-8");

  it("wraps every tool handler with withContextRelease at registration", () => {
    expect(src).toContain("const activeToolContexts = new AsyncLocalStorage<ToolContext[]>()");
    expect(src).toContain("function withContextRelease(");
    // regTool must wrap the trailing handler argument before collecting the
    // thunk (marker updated for Phase 5: the call gained a toolName arg)
    expect(src).toContain("args[last] = withContextRelease(");
    // the wrapper must release every opened context in a finally
    expect(src).toMatch(/finally \{\s*for \(const c of opened\) releaseClientReadFromContext\(c\);/);
  });

  it("provides a last-resort error envelope for handlers without their own catch", () => {
    // v5.12.x Phase 5: throws that escape a handler become isError content
    // with corruption-recovery formatting, logged to stderr — never a raw
    // JSON-RPC error and never stdout.
    expect(src).toContain('logError(err, { module: "mcp", op: toolName })');
    expect(src).toContain("formatMcpError(`in ${toolName}`, err)");
  });

  it("registers contexts from BOTH resolveToolContext return paths", () => {
    const registrations = src.match(/activeToolContexts\.getStore\(\)\?\.push\(ctx\)/g) ?? [];
    expect(registrations.length).toBe(2); // default path + projectRoot-scoped path
  });

  it("release is idempotent so per-handler finally blocks remain safe", () => {
    expect(src).toContain("ctx.clientRead = null;");
  });

  it("installs process-level guards in serve mode (stderr only, no stdout)", () => {
    expect(src).toContain('process.on("unhandledRejection"');
    expect(src).toContain('process.on("uncaughtException"');
    // guards must log via console.error — never stdout (JSON-RPC framing)
    const guardBlock = src.slice(
      src.indexOf('process.on("unhandledRejection"'),
      src.indexOf("startUpgradeMarkerWatcher()"),
    );
    expect(guardBlock).not.toContain("console.log");
    expect(guardBlock).not.toContain("process.stdout");
  });
});
