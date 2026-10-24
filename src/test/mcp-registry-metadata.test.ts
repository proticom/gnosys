import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("MCP Registry metadata", () => {
  it("matches the npm package and configures stdio startup", () => {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    const server = JSON.parse(readFileSync(new URL("../../server.json", import.meta.url), "utf8"));

    expect(server.name).toBe(pkg.mcpName);
    expect(server.version).toBe(pkg.version);
    expect(server.packages[0].identifier).toBe(pkg.name);
    expect(server.packages[0].version).toBe(pkg.version);
    expect(server.packages[0].transport.type).toBe("stdio");
    expect(server.packages[0].packageArguments).toEqual([{ type: "positional", value: "serve" }]);
    expect(server.description.length).toBeLessThanOrEqual(100);
  });
});
