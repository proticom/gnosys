/**
 * v6.0.0: the chat feature (TUI + setup wizard) was removed.
 * Existing user gnosys.json files may still contain `chat` and
 * `taskModels.chat` sections. Config loading must TOLERATE those keys —
 * strip them silently (Zod strips unknown keys) and never crash.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { loadConfig, GnosysConfigSchema } from "../lib/config.js";

describe("v6.0.0 chat config backward compatibility", () => {
  let scratch: string;
  let prevHome: string | undefined;

  beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-chat-backcompat-"));
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

  it("loads a config file containing chat and taskModels.chat keys without crashing", async () => {
    const storeDir = path.join(scratch, "store");
    fs.mkdirSync(storeDir, { recursive: true });
    fs.writeFileSync(
      path.join(storeDir, "gnosys.json"),
      JSON.stringify({
        llm: { defaultProvider: "ollama" },
        chat: { toolsEnabled: true, systemPromptPrefix: "be nice" },
        taskModels: {
          synthesis: { provider: "ollama", model: "llama3.2" },
          chat: { provider: "anthropic", model: "claude-haiku-4-5" },
        },
      }),
      "utf8",
    );

    vi.spyOn(console, "error").mockImplementation(() => {});
    const config = await loadConfig(storeDir);

    // Chat keys are stripped, everything else survives.
    expect((config as Record<string, unknown>).chat).toBeUndefined();
    expect(
      (config.taskModels as Record<string, unknown>).chat,
    ).toBeUndefined();
    expect(config.llm.defaultProvider).toBe("ollama");
    expect(config.taskModels?.synthesis).toEqual({
      provider: "ollama",
      model: "llama3.2",
    });
  });

  it("schema parse strips chat keys directly", () => {
    const parsed = GnosysConfigSchema.parse({
      chat: { toolsEnabled: false },
      taskModels: { chat: { provider: "openai", model: "gpt-5.4-mini" } },
    });
    expect((parsed as Record<string, unknown>).chat).toBeUndefined();
    expect((parsed.taskModels as Record<string, unknown>).chat).toBeUndefined();
  });
});
