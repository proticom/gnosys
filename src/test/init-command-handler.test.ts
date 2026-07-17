import { describe, expect, it } from "vitest";
import { readCliSource } from "./_helpers.js"; // v6.2.1 cli split

describe("gnosys init command wiring", () => {
  const cli = readCliSource(); // v6.2.1 cli split: read src/cli.ts + src/cli/*.ts

  it("wires init options, project registration, and IDE hooks", () => {
    expect(cli).toContain('.command("init")');
    expect(cli).toContain('.option("-d, --directory <dir>", "Target directory (default: cwd)")');
    expect(cli).toContain('.option("-n, --name <name>", "Project name (default: directory basename)")');
    expect(cli).toContain("await createProjectIdentity(targetDir");
    expect(cli).toContain("await tempResolver.registerProject(targetDir)");
    expect(cli).toContain('const { configureIdeHooks } = await import("./lib/projectIdentity.js")');
    expect(cli).toContain("const hookResult = await configureIdeHooks(targetDir)");
    expect(cli).toContain("gnosys setup ides");
  });
});
