import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const requiredFields: Record<string, string[]> = {
  "gnosys_discover": [
    "query"
  ],
  "gnosys_read": [
    "path"
  ],
  "gnosys_search": [
    "query"
  ],
  "gnosys_add": [
    "input"
  ],
  "gnosys_add_structured": [
    "title",
    "category",
    "tags",
    "content"
  ],
  "gnosys_tags_add": [
    "category",
    "tag"
  ],
  "gnosys_reinforce": [
    "memory_id",
    "signal"
  ],
  "gnosys_init": [
    "directory"
  ],
  "gnosys_migrate": [
    "sourcePath",
    "targetPath"
  ],
  "gnosys_update": [
    "path"
  ],
  "gnosys_commit_context": [
    "context"
  ],
  "gnosys_history": [
    "path"
  ],
  "gnosys_links": [
    "path"
  ],
  "gnosys_bootstrap": [
    "sourceDir"
  ],
  "gnosys_import": [
    "format",
    "data",
    "mapping"
  ],
  "gnosys_hybrid_search": [
    "query"
  ],
  "gnosys_semantic_search": [
    "query"
  ],
  "gnosys_ask": [
    "question"
  ],
  "gnosys_dearchive": [
    "query"
  ],
  "gnosys_export": [
    "targetDir"
  ],
  "gnosys_recall": [
    "query"
  ],
  "gnosys_preference_set": [
    "key",
    "value"
  ],
  "gnosys_preference_delete": [
    "key"
  ],
  "gnosys_federated_search": [
    "query"
  ],
  "gnosys_detect_ambiguity": [
    "query"
  ],
  "gnosys_remote_resolve": [
    "memoryId",
    "choice"
  ],
  "gnosys_attach": [
    "memoryId",
    "filePath"
  ],
  "gnosys_get_attachment": [
    "memoryId"
  ],
  "gnosys_ingest_file": [
    "filePath"
  ],
  "gnosys_trace": [
    "directory"
  ],
  "gnosys_reflect": [
    "outcome"
  ],
  "gnosys_traverse": [
    "memoryId"
  ]
};

describe("MCP tool input fuzzing", () => {
  let client: Client;
  let server: McpServer;
  let home: string;
  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "gnosys-mcp-schema-"));
    vi.stubEnv("GNOSYS_HOME", home);
    vi.stubEnv("GNOSYS_CONFIG_DIR", join(home, "config"));
    vi.stubEnv("GNOSYS_LOCAL_ONLY", "1");
  });
  afterEach(async () => {
    await client?.close();
    await server?.close();
    vi.unstubAllEnvs();
    rmSync(home, { recursive: true, force: true });
  });

  it("rejects malformed input at the declared required-field validation boundary", async () => {
    const { registerCapabilities } = await import("../index.js");
    server = new McpServer({ name: "fuzz", version: "1" });
    registerCapabilities(server, "full");
    client = new Client({ name: "fuzz-client", version: "1" });
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const { tools } = await client.listTools();
    const advertised = Object.fromEntries(tools.filter(tool => tool.inputSchema.required?.length).map(tool => [tool.name, tool.inputSchema.required]));
    expect(advertised).toEqual(requiredFields);
    for (const [name, fields] of Object.entries(requiredFields)) {
      const tool = tools.find(item => item.name === name);
      for (const field of fields) {
        const schema = tool?.inputSchema.properties?.[field];
        const type = typeof schema === "object" && schema !== null && "type" in schema ? schema.type : undefined;
        const invalidValue = type === "number" || type === "integer" ? "not-a-number" : type === "boolean" ? "not-a-boolean" : type === "array" ? "not-an-array" : type === "object" ? "not-an-object" : 123;
        for (const args of [{}, { [field]: invalidValue }]) {
          const result = await client.callTool({ name, arguments: args });
          expect(result.isError, `${name}.${field}`).toBe(true);
          if (!Array.isArray(result.content)) throw new Error("Missing MCP content array");
          const text = result.content.flatMap(block => typeof block === "object" && block !== null && "text" in block && typeof block.text === "string" ? [block.text] : []).join("\n");
          const prefix = `MCP error -32602: Input validation error: Invalid arguments for tool ${name}: `;
          expect(text.startsWith(prefix), text).toBe(true);
          const issues = JSON.parse(text.slice(prefix.length));
          expect(issues.map((issue: { path: string[] }) => issue.path[0]), `${name}.${field}`).toContain(field);
        }
      }
    }
  }, 30_000);
});
