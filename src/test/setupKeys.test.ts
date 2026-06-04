import { execSync } from "child_process";
import fsSync from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateModel } from "../lib/modelValidation.js";
import { askInput, askPassword, askYesNo, writeApiKey } from "../lib/setup.js";
import {
  listProviders,
  renderProviderTable,
  setupKeysTestHooks,
} from "../lib/setupKeys.js";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("../lib/modelValidation.js", () => ({
  validateModel: vi.fn(),
}));

vi.mock("../lib/setup.js", () => ({
  askInput: vi.fn(),
  askPassword: vi.fn(),
  askYesNo: vi.fn(),
  printInfo: vi.fn(),
  printStatus: vi.fn(),
  writeApiKey: vi.fn(),
}));

describe("setup keys", () => {
  const envBackup = { ...process.env };
  const originalPlatform = process.platform;
  const mockedExecSync = vi.mocked(execSync);
  const mockedAskInput = vi.mocked(askInput);
  const mockedAskPassword = vi.mocked(askPassword);
  const mockedAskYesNo = vi.mocked(askYesNo);
  const mockedValidateModel = vi.mocked(validateModel);
  const mockedWriteApiKey = vi.mocked(writeApiKey);
  let tempHome: string | undefined;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env = { ...envBackup };
    clearProviderEnv();
    mockedExecSync.mockReset();
    mockedAskInput.mockReset();
    mockedAskPassword.mockReset();
    mockedAskYesNo.mockReset();
    mockedValidateModel.mockReset();
    mockedWriteApiKey.mockReset();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    process.env = { ...envBackup };
    Object.defineProperty(process, "platform", { value: originalPlatform });
    mockedExecSync.mockReset();
    if (tempHome) {
      fsSync.rmSync(tempHome, { recursive: true, force: true });
      tempHome = undefined;
    }
  });

  function clearProviderEnv(): void {
    for (const key of [
      "GNOSYS_GLOBAL_ANTHROPIC_KEY",
      "GNOSYS_ANTHROPIC_KEY",
      "ANTHROPIC_API_KEY",
      "GNOSYS_GLOBAL_OPENROUTER_KEY",
      "GNOSYS_OPENROUTER_KEY",
      "OPENROUTER_API_KEY",
      "GNOSYS_GLOBAL_OPENAI_KEY",
      "GNOSYS_OPENAI_KEY",
      "OPENAI_API_KEY",
      "GNOSYS_GLOBAL_XAI_KEY",
      "GNOSYS_XAI_KEY",
      "XAI_API_KEY",
      "GNOSYS_GLOBAL_GOOGLE_KEY",
      "GNOSYS_GOOGLE_KEY",
      "GOOGLE_API_KEY",
      "GNOSYS_GLOBAL_COHERE_KEY",
      "GNOSYS_COHERE_KEY",
      "COHERE_API_KEY",
      "GNOSYS_GLOBAL_MISTRAL_KEY",
      "GNOSYS_MISTRAL_KEY",
      "MISTRAL_API_KEY",
      "GNOSYS_GLOBAL_GROQ_KEY",
      "GNOSYS_GROQ_KEY",
      "GROQ_API_KEY",
      "GNOSYS_GLOBAL_CUSTOM_KEY",
      "GNOSYS_CUSTOM_KEY",
      "CUSTOM_API_KEY",
      "GNOSYS_LLM_API_KEY",
    ]) {
      delete process.env[key];
    }
  }

  function writeGnosysDotenv(content: string): string {
    tempHome = fsSync.mkdtempSync(path.join(os.tmpdir(), "gnosys-setup-keys-"));
    process.env.HOME = tempHome;
    const configDir = path.join(tempHome, ".config", "gnosys");
    fsSync.mkdirSync(configDir, { recursive: true });
    const envPath = path.join(configDir, ".env");
    fsSync.writeFileSync(envPath, content, "utf-8");
    return envPath;
  }

  function enableMockKeychain(values: Record<string, string> = {}): void {
    Object.defineProperty(process, "platform", { value: "darwin" });
    delete process.env.VITEST;
    mockedExecSync.mockImplementation((command) => {
      const commandText = String(command);
      if (commandText.includes("add-generic-password")) {
        return "";
      }
      if (commandText.includes("delete-generic-password")) {
        return "";
      }
      const serviceName = Object.keys(values).find((service) =>
        commandText.includes(`-s "${service}"`),
      );
      if (serviceName) {
        return `${values[serviceName]}\n`;
      }
      throw new Error("missing keychain item");
    });
  }

  function keychainCommands(): string[] {
    return mockedExecSync.mock.calls.map(([command]) => String(command));
  }

  it("lists all known providers with env, keychain, dotenv, missing, and local statuses", async () => {
    process.env.GNOSYS_GLOBAL_ANTHROPIC_KEY = "anthropic-env-1111";
    writeGnosysDotenv("GNOSYS_GLOBAL_OPENAI_KEY=openai-dotenv-2222\n");
    enableMockKeychain({
      GNOSYS_GLOBAL_OPENROUTER_KEY: "openrouter-keychain-3333",
    });

    const providers = await listProviders();
    const table = renderProviderTable(providers);

    expect(providers.map((provider) => provider.provider)).toEqual([
      "anthropic",
      "openrouter",
      "openai",
      "xai",
      "google",
      "cohere",
      "mistral",
      "groq",
      "ollama",
      "lmstudio",
      "custom",
    ]);
    expect(providers).toHaveLength(11);
    expect(providers.find((provider) => provider.provider === "anthropic")).toMatchObject({
      found: true,
      location: "env",
      envVarName: "GNOSYS_GLOBAL_ANTHROPIC_KEY",
    });
    expect(providers.find((provider) => provider.provider === "openrouter")).toMatchObject({
      found: true,
      location: "keychain",
      serviceName: "GNOSYS_GLOBAL_OPENROUTER_KEY",
    });
    expect(providers.find((provider) => provider.provider === "openai")).toMatchObject({
      found: true,
      location: "dotenv",
      envVarName: "GNOSYS_GLOBAL_OPENAI_KEY",
    });
    expect(providers.find((provider) => provider.provider === "xai")).toMatchObject({
      found: false,
      location: "none",
    });
    expect(providers.find((provider) => provider.provider === "ollama")).toMatchObject({
      found: false,
      location: "none",
    });
    expect(providers.find((provider) => provider.provider === "lmstudio")).toMatchObject({
      found: false,
      location: "none",
    });
    expect(table).toContain("ollama");
    expect(table).toContain("lmstudio");
    expect(table).toContain("N/A (local)");
  });

  it("detects every configured storage location for a provider independently", () => {
    process.env.GNOSYS_GLOBAL_OPENROUTER_KEY = "global-env-1111";
    process.env.GNOSYS_OPENROUTER_KEY = "provider-env-2222";
    process.env.OPENROUTER_API_KEY = "legacy-env-3333";
    process.env.GNOSYS_LLM_API_KEY = "generic-env-4444";
    writeGnosysDotenv([
      "GNOSYS_GLOBAL_OPENROUTER_KEY=global-dotenv-5555",
      "GNOSYS_OPENROUTER_KEY=provider-dotenv-6666",
      "OPENROUTER_API_KEY=legacy-dotenv-7777",
      "GNOSYS_LLM_API_KEY=generic-dotenv-8888",
      "",
    ].join("\n"));
    enableMockKeychain({
      GNOSYS_GLOBAL_OPENROUTER_KEY: "global-keychain-9999",
      GNOSYS_OPENROUTER_KEY: "provider-keychain-0000",
    });

    const locations = setupKeysTestHooks.listKeyLocations("openrouter");

    expect(locations.map((location) => ({
      location: location.location,
      envVarName: location.envVarName,
      serviceName: location.serviceName,
      value: location.value,
    }))).toEqual([
      {
        location: "env",
        envVarName: "GNOSYS_GLOBAL_OPENROUTER_KEY",
        serviceName: undefined,
        value: "global-env-1111",
      },
      {
        location: "keychain",
        envVarName: undefined,
        serviceName: "GNOSYS_GLOBAL_OPENROUTER_KEY",
        value: "global-keychain-9999",
      },
      {
        location: "dotenv",
        envVarName: "GNOSYS_GLOBAL_OPENROUTER_KEY",
        serviceName: undefined,
        value: "global-dotenv-5555",
      },
      {
        location: "env",
        envVarName: "GNOSYS_OPENROUTER_KEY",
        serviceName: undefined,
        value: "provider-env-2222",
      },
      {
        location: "keychain",
        envVarName: undefined,
        serviceName: "GNOSYS_OPENROUTER_KEY",
        value: "provider-keychain-0000",
      },
      {
        location: "dotenv",
        envVarName: "GNOSYS_OPENROUTER_KEY",
        serviceName: undefined,
        value: "provider-dotenv-6666",
      },
      {
        location: "env",
        envVarName: "OPENROUTER_API_KEY",
        serviceName: undefined,
        value: "legacy-env-3333",
      },
      {
        location: "dotenv",
        envVarName: "OPENROUTER_API_KEY",
        serviceName: undefined,
        value: "legacy-dotenv-7777",
      },
      {
        location: "env",
        envVarName: "GNOSYS_LLM_API_KEY",
        serviceName: undefined,
        value: "generic-env-4444",
      },
      {
        location: "dotenv",
        envVarName: "GNOSYS_LLM_API_KEY",
        serviceName: undefined,
        value: "generic-dotenv-8888",
      },
    ]);
  });

  it("does not list key locations for local providers", () => {
    process.env.GNOSYS_GLOBAL_OLLAMA_KEY = "should-not-matter";

    expect(setupKeysTestHooks.listKeyLocations("ollama")).toEqual([]);
    expect(setupKeysTestHooks.listKeyLocations("lmstudio")).toEqual([]);
  });

  it("supports the custom provider slot", async () => {
    process.env.GNOSYS_GLOBAL_CUSTOM_KEY = "custom-env-1234";

    const providers = await listProviders();

    expect(providers.find((provider) => provider.provider === "custom")).toMatchObject({
      found: true,
      location: "env",
      envVarName: "GNOSYS_GLOBAL_CUSTOM_KEY",
    });
    expect(setupKeysTestHooks.listKeyLocations("custom")).toEqual([
      expect.objectContaining({
        location: "env",
        envVarName: "GNOSYS_GLOBAL_CUSTOM_KEY",
        value: "custom-env-1234",
      }),
    ]);
  });

  it("removes only the requested provider keys from the gnosys dotenv file", async () => {
    const envPath = writeGnosysDotenv([
      "# keep this comment",
      "GNOSYS_GLOBAL_OPENROUTER_KEY=delete-global",
      "GNOSYS_OPENROUTER_KEY=delete-provider",
      "GNOSYS_GLOBAL_OPENAI_KEY=keep-openai",
      "  OPENROUTER_API_KEY = delete-legacy",
      "GNOSYS_LLM_API_KEY=keep-generic",
      "",
    ].join("\n"));

    const removed = await setupKeysTestHooks.removeDotenvKeys([
      "GNOSYS_GLOBAL_OPENROUTER_KEY",
      "GNOSYS_OPENROUTER_KEY",
      "OPENROUTER_API_KEY",
    ]);

    expect(removed).toBe(3);
    expect(fsSync.readFileSync(envPath, "utf-8")).toBe([
      "# keep this comment",
      "GNOSYS_GLOBAL_OPENAI_KEY=keep-openai",
      "GNOSYS_LLM_API_KEY=keep-generic",
      "",
    ].join("\n"));
  });

  it("validates an updated key before writing it to dotenv", async () => {
    mockedAskPassword.mockResolvedValue("valid-openrouter-key");
    mockedValidateModel.mockResolvedValue({ ok: true });
    mockedAskInput.mockResolvedValue("2");

    await setupKeysTestHooks.updateKey({} as never, "openrouter");

    expect(mockedValidateModel).toHaveBeenCalledWith(
      "openrouter",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "valid-openrouter-key",
    );
    expect(mockedWriteApiKey).toHaveBeenCalledWith(
      "openrouter",
      "valid-openrouter-key",
      { scope: "global" },
    );
  });

  it("rejects an invalid key before choosing a storage destination", async () => {
    mockedAskPassword.mockResolvedValue("invalid-openrouter-key");
    mockedValidateModel.mockResolvedValue({ ok: false, error: "HTTP 401: Invalid API key" });

    await setupKeysTestHooks.updateKey({} as never, "openrouter");

    expect(mockedValidateModel).toHaveBeenCalledOnce();
    expect(mockedAskInput).not.toHaveBeenCalled();
    expect(mockedWriteApiKey).not.toHaveBeenCalled();
    expect(mockedExecSync).not.toHaveBeenCalled();
  });

  it("routes destination choice to keychain, dotenv, or manual env instructions", async () => {
    enableMockKeychain();
    mockedAskInput.mockResolvedValueOnce("1");
    await setupKeysTestHooks.chooseKeyDestination(
      {} as never,
      "anthropic",
      "anthropic-keychain-key",
    );
    expect(mockedExecSync).toHaveBeenCalledWith(
      expect.stringContaining("security add-generic-password"),
      expect.objectContaining({ stdio: "pipe" }),
    );
    expect(mockedExecSync).toHaveBeenCalledWith(
      expect.stringContaining('GNOSYS_GLOBAL_ANTHROPIC_KEY'),
      expect.objectContaining({ stdio: "pipe" }),
    );

    mockedAskInput.mockResolvedValueOnce("2");
    await setupKeysTestHooks.chooseKeyDestination(
      {} as never,
      "anthropic",
      "anthropic-dotenv-key",
    );
    expect(mockedWriteApiKey).toHaveBeenCalledWith(
      "anthropic",
      "anthropic-dotenv-key",
      { scope: "global" },
    );

    mockedAskInput.mockResolvedValueOnce("3");
    await setupKeysTestHooks.chooseKeyDestination(
      {} as never,
      "anthropic",
      "anthropic-manual-key",
    );
    expect(mockedWriteApiKey).toHaveBeenCalledTimes(1);
    expect(mockedExecSync).toHaveBeenCalledTimes(1);
  });

  it("copies a dotenv-only key to keychain and removes the dotenv line", async () => {
    const envPath = writeGnosysDotenv([
      "GNOSYS_GLOBAL_OPENROUTER_KEY=dotenv-openrouter-key",
      "GNOSYS_GLOBAL_OPENAI_KEY=keep-openai",
      "",
    ].join("\n"));
    mockedValidateModel.mockResolvedValue({ ok: true });
    mockedAskYesNo.mockResolvedValue(true);
    enableMockKeychain();

    await setupKeysTestHooks.copyToKeychain({} as never, "openrouter");

    expect(mockedValidateModel).toHaveBeenCalledWith(
      "openrouter",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "dotenv-openrouter-key",
    );
    expect(keychainCommands()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("security add-generic-password"),
        expect.stringContaining('GNOSYS_GLOBAL_OPENROUTER_KEY'),
        expect.stringContaining('dotenv-openrouter-key'),
      ]),
    );
    expect(fsSync.readFileSync(envPath, "utf-8")).toBe([
      "GNOSYS_GLOBAL_OPENAI_KEY=keep-openai",
      "",
    ].join("\n"));
  });

  it("does not copy to keychain or change dotenv when validation fails", async () => {
    const envPath = writeGnosysDotenv([
      "GNOSYS_GLOBAL_OPENROUTER_KEY=bad-dotenv-key",
      "GNOSYS_GLOBAL_OPENAI_KEY=keep-openai",
      "",
    ].join("\n"));
    mockedValidateModel.mockResolvedValue({ ok: false, error: "HTTP 401: Invalid API key" });
    mockedAskYesNo.mockResolvedValue(true);

    await setupKeysTestHooks.copyToKeychain({} as never, "openrouter");

    expect(mockedValidateModel).toHaveBeenCalledOnce();
    expect(mockedAskYesNo).not.toHaveBeenCalled();
    expect(keychainCommands()).not.toEqual(
      expect.arrayContaining([expect.stringContaining("security add-generic-password")]),
    );
    expect(fsSync.readFileSync(envPath, "utf-8")).toBe([
      "GNOSYS_GLOBAL_OPENROUTER_KEY=bad-dotenv-key",
      "GNOSYS_GLOBAL_OPENAI_KEY=keep-openai",
      "",
    ].join("\n"));
  });

  it("does not duplicate a key that is already in keychain", async () => {
    enableMockKeychain({
      GNOSYS_GLOBAL_OPENROUTER_KEY: "already-keychain-key",
    });
    mockedValidateModel.mockResolvedValue({ ok: true });
    mockedAskYesNo.mockResolvedValue(true);

    await setupKeysTestHooks.copyToKeychain({} as never, "openrouter");

    expect(mockedValidateModel).not.toHaveBeenCalled();
    expect(mockedAskYesNo).not.toHaveBeenCalled();
    expect(keychainCommands()).not.toEqual(
      expect.arrayContaining([expect.stringContaining("security add-generic-password")]),
    );
  });

  it("deletes a dotenv-only key after confirmation", async () => {
    const envPath = writeGnosysDotenv([
      "GNOSYS_GLOBAL_OPENROUTER_KEY=delete-dotenv-key",
      "GNOSYS_GLOBAL_OPENAI_KEY=keep-openai",
      "",
    ].join("\n"));
    mockedAskYesNo.mockResolvedValue(true);

    const result = await setupKeysTestHooks.deleteKey({} as never, "openrouter");

    expect(result).toBe("list");
    expect(mockedAskYesNo).toHaveBeenCalledWith({} as never, "Delete?", false);
    expect(fsSync.readFileSync(envPath, "utf-8")).toBe([
      "GNOSYS_GLOBAL_OPENAI_KEY=keep-openai",
      "",
    ].join("\n"));
  });

  it("deletes a keychain-only key after confirmation", async () => {
    enableMockKeychain({
      GNOSYS_GLOBAL_OPENROUTER_KEY: "delete-keychain-key",
    });
    mockedAskYesNo.mockResolvedValue(true);

    const result = await setupKeysTestHooks.deleteKey({} as never, "openrouter");

    expect(result).toBe("list");
    expect(keychainCommands()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("security delete-generic-password"),
        expect.stringContaining('GNOSYS_GLOBAL_OPENROUTER_KEY'),
      ]),
    );
  });

  it("deletes all removable keychain and dotenv copies when requested", async () => {
    const envPath = writeGnosysDotenv([
      "GNOSYS_GLOBAL_OPENROUTER_KEY=delete-dotenv-copy",
      "GNOSYS_GLOBAL_OPENAI_KEY=keep-openai",
      "",
    ].join("\n"));
    enableMockKeychain({
      GNOSYS_GLOBAL_OPENROUTER_KEY: "delete-keychain-copy",
    });
    mockedAskYesNo.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

    const result = await setupKeysTestHooks.deleteKey({} as never, "openrouter");

    expect(result).toBe("list");
    expect(mockedAskYesNo).toHaveBeenCalledWith({} as never, "Delete?", false);
    expect(mockedAskYesNo).toHaveBeenCalledWith(
      {} as never,
      "Delete all stored copies that Gnosys can remove?",
      false,
    );
    expect(keychainCommands()).toEqual(
      expect.arrayContaining([
        expect.stringContaining("security delete-generic-password"),
        expect.stringContaining('GNOSYS_GLOBAL_OPENROUTER_KEY'),
      ]),
    );
    expect(fsSync.readFileSync(envPath, "utf-8")).toBe([
      "GNOSYS_GLOBAL_OPENAI_KEY=keep-openai",
      "",
    ].join("\n"));
  });
});
