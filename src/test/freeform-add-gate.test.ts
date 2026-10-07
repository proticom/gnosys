import { afterEach, describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { registerCapabilities } from "../index.js";
import { generateRulesBlock } from "../lib/rulesGen.js";

const textResult = z.object({ isError: z.boolean(), content: z.array(z.object({ type: z.literal("text"), text: z.string() })) });

afterEach(() => vi.unstubAllEnvs());

async function freeformCall() {
  vi.stubEnv("GNOSYS_ALLOW_FREEFORM_ADD", "");
  const server = new McpServer({ name: "gate-test", version: "1.0.0" });
  registerCapabilities(server, "full");
  const client = new Client({ name: "gate-client", version: "1.0.0" });
  const [st, ct] = InMemoryTransport.createLinkedPair();
  try {
    await Promise.all([server.connect(st), client.connect(ct)]);
    return textResult.parse(await client.callTool({ name: "gnosys_add", arguments: { input: "Keep this decision" } }));
  } finally {
    await client.close();
    await server.close();
  }
}

describe("gnosys_add freeform gate", () => {
  it("rejects freeform MCP writes by default", async () => {
    const result = await freeformCall();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("gnosys_add is disabled for LLM agents");
    expect(result.content[0].text).toContain("Retry now with gnosys_add_structured");
  });

  it("redirect message lists the structured fields agents must supply", async () => {
    const result = await freeformCall();
    expect(result.isError).toBe(true);
    for (const field of ["title (string)", "tags (object of string arrays", "content (markdown body)", "relevance (space-separated keyword cloud", "GNOSYS_ALLOW_FREEFORM_ADD=1"]) {
      expect(result.content[0].text).toContain(field);
    }
  });

  it("generated agent rules state the server rejects freeform gnosys_add", () => {
    const rules = generateRulesBlock([], []);
    expect(rules).toContain("NEVER call the freeform `gnosys_add`");
    expect(rules).toContain("rejects it with an error");
    expect(rules).toContain("GNOSYS_ALLOW_FREEFORM_ADD=1");
  });
});
