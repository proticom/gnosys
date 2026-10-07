import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { createInterface } from "readline/promises";
import { PassThrough } from "stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listProviders, renderProviderTable, runKeysSetup } from "../lib/setupKeys.js";

vi.mock("child_process", async (importOriginal) => ({
  ...await importOriginal<typeof import("child_process")>(),
  execSync: vi.fn(),
}));

describe("setup keys", () => {
  const originalEnv = { ...process.env };
  const originalPlatform = process.platform;
  let home: string;
  let envPath: string;
  let keychain: Record<string, string>;
  let writes: string[];
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env = { ...originalEnv };
    for (const name of Object.keys(process.env)) {
      if (/^(GNOSYS_.*KEY|[A-Z]+_API_KEY|VOYAGE_API_KEY)$/.test(name)) delete process.env[name];
    }
    delete process.env.VITEST;
    home = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-key-workflow-"));
    process.env.HOME = home;
    vi.spyOn(os, "homedir").mockReturnValue(home);
    writes = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => { writes.push(String(chunk)); return true; });
    envPath = path.join(home, ".config", "gnosys", ".env");
    fs.mkdirSync(path.dirname(envPath), { recursive: true });
    fs.writeFileSync(envPath, "");
    keychain = {};
    Object.defineProperty(process, "platform", { value: "darwin" });
    vi.mocked(execSync).mockImplementation((command) => {
      const text = String(command);
      const service = text.match(/-s "([^"]+)"/)?.[1];
      if (!service) throw new Error("Unexpected OS command");
      if (text.includes("add-generic-password")) {
        keychain[service] = text.match(/-w "([^"]+)"/)?.[1] ?? "";
        return "";
      }
      if (text.includes("delete-generic-password")) {
        if (!(service in keychain)) throw new Error("Key not found");
        delete keychain[service];
        return "";
      }
      if (!(service in keychain)) throw new Error("Key not found");
      return `${keychain[service]}\n`;
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    log = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
    Object.defineProperty(process, "platform", { value: originalPlatform });
    fs.rmSync(home, { recursive: true, force: true });
  });

  const output = () => log.mock.calls.map((args: unknown[]) => args.join(" ")).join("\n") + writes.join("");
  const writeKeys = (text: string) => fs.writeFileSync(envPath, text);
  const readKeys = () => fs.readFileSync(envPath, "utf8");

  async function runWizard(answers: string[]): Promise<string> {
    const pending = [...answers];
    const input = new PassThrough();
    const sink = new PassThrough();
    const rl = createInterface({ input, output: sink, terminal: false });
    vi.spyOn(rl, "question").mockImplementation(async () => {
      const next = pending.shift();
      if (next === undefined) throw new Error("Wizard requested unexpected input");
      return next;
    });
    try {
      await runKeysSetup({ rl });
      expect(pending).toEqual([]);
      return output();
    } finally {
      rl.close();
      input.destroy();
      sink.destroy();
    }
  }

  it("lists all known providers with env, keychain, dotenv, missing, and local statuses", async () => {
    process.env.GNOSYS_GLOBAL_ANTHROPIC_KEY = "anthropic-env-1111";
    writeKeys("GNOSYS_GLOBAL_OPENAI_KEY=openai-dotenv-2222\n");
    keychain.GNOSYS_GLOBAL_OPENROUTER_KEY = "openrouter-keychain-3333";
    const providers = await listProviders();
    expect(providers.map(({ provider }) => provider)).toEqual([
      "anthropic", "openrouter", "openai", "xai", "google", "cohere", "mistral", "groq", "ollama", "lmstudio", "custom",
    ]);
    expect(providers.slice(0, 4)).toMatchObject([
      { provider: "anthropic", found: true, location: "env", envVarName: "GNOSYS_GLOBAL_ANTHROPIC_KEY" },
      { provider: "openrouter", found: true, location: "keychain", serviceName: "GNOSYS_GLOBAL_OPENROUTER_KEY" },
      { provider: "openai", found: true, location: "dotenv", envVarName: "GNOSYS_GLOBAL_OPENAI_KEY" },
      { provider: "xai", found: false, location: "none" },
    ]);
    expect(renderProviderTable(providers)).toContain("N/A (local)");
  });

  it("detects every configured storage location for a provider independently", async () => {
    process.env.GNOSYS_GLOBAL_OPENROUTER_KEY = "global-env-1111";
    process.env.GNOSYS_OPENROUTER_KEY = "provider-env-2222";
    process.env.OPENROUTER_API_KEY = "legacy-env-3333";
    process.env.GNOSYS_LLM_API_KEY = "generic-env-4444";
    writeKeys("GNOSYS_GLOBAL_OPENROUTER_KEY=global-dotenv-5555\nGNOSYS_OPENROUTER_KEY=provider-dotenv-6666\nOPENROUTER_API_KEY=legacy-dotenv-7777\nGNOSYS_LLM_API_KEY=generic-dotenv-8888\n");
    keychain = { GNOSYS_GLOBAL_OPENROUTER_KEY: "global-keychain-9999", GNOSYS_OPENROUTER_KEY: "provider-keychain-0000" };
    const rendered = await runWizard(["2", "b", "q"]);
    expect(rendered).toContain("Stored in: Env Var (GNOSYS_GLOBAL_OPENROUTER_KEY)");
    for (const suffix of ["1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999", "0000"]) {
      expect(rendered).toContain(suffix);
    }
    expect(rendered).toContain("Also found:");
    expect(rendered).not.toContain("global-env-1111");
  });

  it("does not list key locations for local providers", async () => {
    process.env.GNOSYS_GLOBAL_OLLAMA_KEY = "should-not-matter";
    const rendered = await runWizard(["9", "b", "10", "b", "q"]);
    expect(rendered.match(/Status: {4}N\/A \(local provider\)/g)).toHaveLength(2);
    expect(rendered).not.toContain("should-not-matter");
    expect(rendered).toContain("[t]  Test local provider");
  });

  it("supports the custom provider slot", async () => {
    process.env.GNOSYS_GLOBAL_CUSTOM_KEY = "custom-env-1234";
    expect((await listProviders()).find(({ provider }) => provider === "custom")).toMatchObject({
      found: true, location: "env", envVarName: "GNOSYS_GLOBAL_CUSTOM_KEY", lastFour: "••••1234",
    });
  });

  it("removes only the requested provider keys from the gnosys dotenv file", async () => {
    writeKeys("# keep this comment\nGNOSYS_GLOBAL_OPENROUTER_KEY=delete-global\nGNOSYS_OPENROUTER_KEY=keep-alias\nGNOSYS_GLOBAL_OPENAI_KEY=keep-openai\n");
    await runWizard(["2", "d", "y", "n", "q"]);
    expect(readKeys()).toBe("# keep this comment\nGNOSYS_OPENROUTER_KEY=keep-alias\nGNOSYS_GLOBAL_OPENAI_KEY=keep-openai\n");
  });

  it("validates an updated key before writing it to dotenv", async () => {
    const rendered = await runWizard(["2", "u", "valid-openrouter-key", "2", "b", "q"]);
    expect(readKeys()).toBe("GNOSYS_GLOBAL_OPENROUTER_KEY=valid-openrouter-key\n");
    expect(rendered).toContain("✓ Key is valid");
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: "Bearer valid-openrouter-key" });
  });

  it("rejects an invalid key before choosing a storage destination", async () => {
    writeKeys("GNOSYS_GLOBAL_OPENAI_KEY=keep-openai\n");
    vi.mocked(fetch).mockResolvedValue(new Response('{"error":{"message":"bad key"}}', { status: 401 }));
    const rendered = await runWizard(["2", "u", "bad-key", "b", "q"]);
    expect(readKeys()).toBe("GNOSYS_GLOBAL_OPENAI_KEY=keep-openai\n");
    expect(keychain).toEqual({});
    expect(rendered).toContain("401 Unauthorized - bad key");
    expect(rendered).toContain("key not stored because validation failed");
  });

  it("routes destination choice to keychain, dotenv, or manual env instructions", async () => {
    await runWizard(["2", "u", "keychain-key", "1", "b", "q"]);
    await runWizard(["2", "u", "dotenv-key", "2", "b", "q"]);
    const rendered = await runWizard(["2", "u", "manual-key", "3", "b", "q"]);
    expect(keychain).toEqual({ GNOSYS_GLOBAL_OPENROUTER_KEY: "keychain-key" });
    expect(readKeys()).toBe("GNOSYS_GLOBAL_OPENROUTER_KEY=dotenv-key\n");
    expect(rendered).toContain("No key was stored by Gnosys.");
  });

  it("copies a dotenv-only key to keychain and removes the dotenv line", async () => {
    writeKeys("GNOSYS_GLOBAL_OPENROUTER_KEY=copy-this-key\nGNOSYS_GLOBAL_OPENAI_KEY=keep-openai\n");
    await runWizard(["2", "c", "y", "b", "q"]);
    expect(keychain).toEqual({ GNOSYS_GLOBAL_OPENROUTER_KEY: "copy-this-key" });
    expect(readKeys()).toBe("GNOSYS_GLOBAL_OPENAI_KEY=keep-openai\n");
  });

  it("does not copy to keychain or change dotenv when validation fails", async () => {
    writeKeys("GNOSYS_GLOBAL_OPENROUTER_KEY=invalid-key\n");
    vi.mocked(fetch).mockResolvedValue(new Response("bad key", { status: 401 }));
    const rendered = await runWizard(["2", "c", "b", "q"]);
    expect(keychain).toEqual({});
    expect(readKeys()).toBe("GNOSYS_GLOBAL_OPENROUTER_KEY=invalid-key\n");
    expect(rendered).toContain("copy cancelled because validation failed");
  });

  it("does not duplicate a key that is already in keychain", async () => {
    keychain.GNOSYS_GLOBAL_OPENROUTER_KEY = "already-secure";
    const rendered = await runWizard(["2", "c", "b", "q"]);
    expect(keychain).toEqual({ GNOSYS_GLOBAL_OPENROUTER_KEY: "already-secure" });
    expect(rendered).toContain("key is already in Keychain");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("deletes a dotenv-only key after confirmation", async () => {
    writeKeys("GNOSYS_GLOBAL_OPENROUTER_KEY=delete-me\nGNOSYS_GLOBAL_OPENAI_KEY=keep-openai\n");
    await runWizard(["2", "d", "y", "q"]);
    expect(readKeys()).toBe("GNOSYS_GLOBAL_OPENAI_KEY=keep-openai\n");
    expect(output()).toContain("deleted 1 stored key");
  });

  it("deletes a keychain-only key after confirmation", async () => {
    keychain.GNOSYS_GLOBAL_OPENROUTER_KEY = "delete-me";
    await runWizard(["2", "d", "y", "q"]);
    expect(keychain).toEqual({});
    expect(output()).toContain("deleted 1 stored key");
  });

  it("deletes all removable keychain and dotenv copies when requested", async () => {
    keychain.GNOSYS_GLOBAL_OPENROUTER_KEY = "delete-keychain";
    writeKeys("GNOSYS_GLOBAL_OPENROUTER_KEY=delete-dotenv\nGNOSYS_GLOBAL_OPENAI_KEY=keep-openai\n");
    await runWizard(["2", "d", "y", "y", "q"]);
    expect(keychain).toEqual({});
    expect(readKeys()).toBe("GNOSYS_GLOBAL_OPENAI_KEY=keep-openai\n");
    expect(output()).toContain("deleted 2 stored keys");
  });
});
