import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const external = vi.hoisted(() => ({
  provider: vi.fn(() => null),
  validate: vi.fn(async () => ({ ok: true })),
  keychain: vi.fn(() => "test-only-key"),
  pipeline: vi.fn(),
}));
vi.mock("../lib/llm.js", () => ({ getLLMProvider: external.provider }));
vi.mock("../lib/modelValidation.js", () => ({ validateModel: external.validate }));
vi.mock("child_process", async (original) => ({
  ...await original<typeof import("child_process")>(), execSync: external.keychain,
}));
vi.mock("@huggingface/transformers", () => ({ pipeline: external.pipeline }));
vi.mock("../lib/embeddingHealth.js", () => ({ checkEmbeddingPackage: () => ({ kind: "available" }) }));

let root: string;
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  if (root) rmSync(root, { recursive: true, force: true });
});

it("initializes offline search without providers, model downloads, or keychain access on the designated dream machine", async () => {
  vi.resetModules();
  vi.clearAllMocks();
  root = mkdtempSync(join(tmpdir(), "gnosys-init-offline-"));
  const brain = join(root, "brain");
  const project = join(root, "project");
  mkdirSync(brain);
  mkdirSync(project);
  vi.stubEnv("HOME", root);
  vi.stubEnv("USERPROFILE", root);
  vi.stubEnv("GNOSYS_HOME", brain);
  vi.stubEnv("GNOSYS_PERSONAL", "");
  vi.stubEnv("GNOSYS_GLOBAL", "");
  vi.stubEnv("GNOSYS_TRANSPORT", "stdio");
  vi.stubEnv("GNOSYS_OPENAI_KEY", process.platform === "darwin" ? "" : "test-only-key");
  vi.spyOn(process, "cwd").mockReturnValue(root);
  writeFileSync(join(brain, "gnosys.json"), JSON.stringify({
    llm: { defaultProvider: "openai", openai: { model: "gpt-4o-mini" } },
    dream: { enabled: true, provider: "openai", model: "gpt-4o-mini" },
  }));
  const { GnosysDB } = await import("../lib/db.js");
  const db = GnosysDB.openCentral();
  db.setMeta("machine_id", "offline-test-machine");
  db.setDreamMachineId("offline-test-machine");
  db.close();

  const [st, ct] = InMemoryTransport.createLinkedPair();
  const connect = McpServer.prototype.connect;
  let server: McpServer | undefined;
  vi.spyOn(McpServer.prototype, "connect").mockImplementation(function (this: McpServer) {
    server = this;
    return connect.call(this, st);
  });
  const rejectionListeners = process.listeners("unhandledRejection");
  const exceptionListeners = process.listeners("uncaughtException");
  const client = new Client({ name: "offline-init-test", version: "1" });
  const { startMcpServer, ensureHeavyDeps } = await import("../index.js");
  const queue = await import("../lib/embedQueue.js");
  try {
    await Promise.all([startMcpServer(), client.connect(ct)]);
    const result = await client.callTool({ name: "gnosys_init", arguments: { directory: project } });
    expect(result.isError).not.toBe(true);
    expect(JSON.stringify(result.content)).toContain("initialized");
    const identity = JSON.parse(readFileSync(join(project, ".gnosys/gnosys.json"), "utf8"));
    const check = GnosysDB.openCentral();
    try {
      expect(check.getProject(identity.projectId)?.working_directory).toBe(project);
      expect(check.getDreamMachineId()).toBe("offline-test-machine");
    } finally { check.close(); }
    expect(queue.isWriteTimeEmbeddingEnabled()).toBe(true);
    expect(external.provider).toHaveBeenCalledTimes(0);
    expect(external.validate).toHaveBeenCalledTimes(0);
    expect(external.keychain).toHaveBeenCalledTimes(0);
    expect(external.pipeline).toHaveBeenCalledTimes(0);
    const search = await client.callTool({ name: "gnosys_hybrid_search", arguments: { query: "offline", mode: "keyword", projectRoot: project } });
    expect(search.isError).not.toBe(true);
    expect(JSON.stringify(search.content)).toContain("No results");
    expect(external.provider).toHaveBeenCalledTimes(0);
    expect(external.pipeline).toHaveBeenCalledTimes(0);
    await ensureHeavyDeps();
    expect(external.provider).toHaveBeenCalledTimes(2);
    expect(external.validate).toHaveBeenCalledTimes(1);
    expect(external.keychain).toHaveBeenCalledTimes(process.platform === "darwin" ? 1 : 0);
  } finally {
    queue.disableWriteTimeEmbedding();
    await client.close();
    await server?.close();
    for (const listener of process.listeners("unhandledRejection")) if (!rejectionListeners.includes(listener)) process.removeListener("unhandledRejection", listener);
    for (const listener of process.listeners("uncaughtException")) if (!exceptionListeners.includes(listener)) process.removeListener("uncaughtException", listener);
  }
});
