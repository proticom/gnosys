/**
 * v5.15.4 — gnosys_add freeform gate.
 *
 * Decision (Edward, 2026-07-04, deci-01KWP25KKJYP7M3YCPFRPWEEYN): LLM agents
 * must ALWAYS use gnosys_add_structured. Advisory wording in tool
 * descriptions and generated IDE rules was not enough — agents still called
 * the freeform tool. The MCP gnosys_add handler now hard-rejects unless
 * GNOSYS_ALLOW_FREEFORM_ADD=1 (genuine non-agent scripts/cron), returning an
 * actionable redirect that tells the agent to retry with
 * gnosys_add_structured and lists the required fields.
 *
 * These tests assert the gate at the source level (the handler's guard and
 * message) and that the generated agent rules carry the matching hard-ban
 * wording, without booting a full MCP server.
 */

import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, "..");

describe("gnosys_add freeform gate (source-level contract)", () => {
  it("index.ts gates the gnosys_add handler behind GNOSYS_ALLOW_FREEFORM_ADD", async () => {
    const src = await fs.readFile(path.join(SRC, "index.ts"), "utf-8");
    // The guard must exist and must redirect to the structured tool.
    expect(src).toContain('process.env.GNOSYS_ALLOW_FREEFORM_ADD !== "1"');
    expect(src).toContain("gnosys_add is disabled for LLM agents");
    expect(src).toContain("Retry now with gnosys_add_structured");
    // The tool description must warn agents off before they ever call it.
    expect(src).toContain("DO NOT USE if you are an LLM agent");
  });

  it("redirect message lists the structured fields agents must supply", async () => {
    const src = await fs.readFile(path.join(SRC, "index.ts"), "utf-8");
    for (const marker of [
      "title (string)",
      "tags (object of string arrays",
      "content (markdown body)",
      "GNOSYS_ALLOW_FREEFORM_ADD=1",
    ]) {
      expect(src).toContain(marker);
    }
  });

  it("generated agent rules state the server rejects freeform gnosys_add", async () => {
    const rulesGen = await fs.readFile(path.join(SRC, "lib", "rulesGen.ts"), "utf-8");
    expect(rulesGen).toContain("rejects it with an error");
    expect(rulesGen).toContain("GNOSYS_ALLOW_FREEFORM_ADD=1");
  });
});
