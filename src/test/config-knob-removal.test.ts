/**
 * v5.15 config-knob truthfulness: `bulkIngestionBatchSize` and
 * `chat.autoSummarizeAfterTurns` were documented but never read by any code
 * ("settings that lie"), so they were removed from the schema. Old config
 * files containing them must keep loading (Zod strips unknown keys), a
 * one-per-process deprecation warning must land on stderr, and the kept
 * knob `importConcurrency` must retain its default of 5.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { loadConfig, GnosysConfigSchema, DEFAULT_CONFIG } from "../lib/config.js";

describe("v5.15 removed config knobs", () => {
  let scratch: string;
  let prevHome: string | undefined;

  beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-knob-removal-"));
    // Isolate the global-config inheritance step from the real ~/.gnosys.
    prevHome = process.env.GNOSYS_HOME;
    process.env.GNOSYS_HOME = path.join(scratch, "central");
    fs.mkdirSync(process.env.GNOSYS_HOME, { recursive: true });
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.GNOSYS_HOME;
    else process.env.GNOSYS_HOME = prevHome;
    fs.rmSync(scratch, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("still loads a config file containing the removed keys (no throw), strips them, and warns on stderr", async () => {
    const storeDir = path.join(scratch, "store");
    fs.mkdirSync(storeDir, { recursive: true });
    fs.writeFileSync(
      path.join(storeDir, "gnosys.json"),
      JSON.stringify({
        bulkIngestionBatchSize: 250,
        chat: { toolsEnabled: true, autoSummarizeAfterTurns: 3 },
      }),
      "utf8",
    );

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const config = await loadConfig(storeDir);

    // Removed keys absent from the parsed config.
    expect((config as Record<string, unknown>).bulkIngestionBatchSize).toBeUndefined();
    expect(
      (config.chat as Record<string, unknown>).autoSummarizeAfterTurns,
    ).toBeUndefined();

    // Deprecation warning emitted for each removed key found (stderr only).
    const messages = errSpy.mock.calls.map((c) => String(c[0]));
    expect(
      messages.some((m) =>
        m.includes('config option "bulkIngestionBatchSize" was removed in v5.15'),
      ),
    ).toBe(true);
    expect(
      messages.some((m) =>
        m.includes('config option "chat.autoSummarizeAfterTurns" was removed in v5.15'),
      ),
    ).toBe(true);

    // Once per process: a second load must not re-warn.
    errSpy.mockClear();
    await loadConfig(storeDir);
    const secondMessages = errSpy.mock.calls.map((c) => String(c[0]));
    expect(secondMessages.some((m) => m.includes("was removed in v5.15"))).toBe(false);
  });

  it("removed keys are stripped by schema parse and importConcurrency default is 5", () => {
    const parsed = GnosysConfigSchema.parse({
      bulkIngestionBatchSize: 999,
      chat: { autoSummarizeAfterTurns: 7 },
    });
    expect((parsed as Record<string, unknown>).bulkIngestionBatchSize).toBeUndefined();
    expect(
      (parsed.chat as Record<string, unknown>).autoSummarizeAfterTurns,
    ).toBeUndefined();
    expect(parsed.importConcurrency).toBe(5);
    expect(DEFAULT_CONFIG.importConcurrency).toBe(5);
  });
});
