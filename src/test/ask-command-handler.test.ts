import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys ask command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts
  const handler = readFileSync(
    join(process.cwd(), "src/lib/askCommand.ts"),
    "utf-8",
  );

  it("wires ask to runAskCommand via dynamic import", () => {
    expect(cli).toContain('.command("ask <question>")');
    expect(cli).toContain("-l, --limit <n>");
    expect(cli).toContain("-m, --mode <mode>");
    expect(cli).toContain("--no-stream");
    expect(cli).toContain("--federated");
    expect(cli).toContain(
      'const { runAskCommand } = await import("./lib/askCommand.js")',
    );
    expect(cli).toContain("await runAskCommand(getResolver, question, opts)");
  });

  it("exports runAskCommand with LLM, federated, stream, and cleanup markers", () => {
    expect(handler).toContain("export async function runAskCommand");
    expect(handler).toContain("if (!ask.isLLMAvailable)");
    expect(handler).toContain("getSecureStorageSetupHint");
    expect(handler).toContain("federatedSearch");
    expect(handler).toContain("resolved.release()");
    expect(handler).toContain('await import("./clientReadResolve.js")');
    expect(handler).toContain("additionalContext: federatedContext");
    expect(handler).toContain("onToken: (token) => process.stdout.write(token)");
    expect(handler).toContain("GnosysMaintenanceEngine.reinforceBatch");
    expect(handler).toContain("search.close()");
    expect(handler).toContain("embeddings.close()");
    expect(handler).toContain("new GnosysAsk");
    expect(handler).toContain('await import("./ask.js")');
    expect(handler).not.toContain('await import("./lib/ask.js")');
  });
});
