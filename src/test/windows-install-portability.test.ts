import { describe, expect, it } from "vitest";
import fs from "fs";
import { runOptionalPostinstall } from "../lib/postinstallRunner.js";

describe("Windows npm install portability", () => {
  it("does not rely on the POSIX true command in postinstall", () => {
    const pkg = JSON.parse(
      fs.readFileSync(new URL("../../package.json", import.meta.url), "utf-8"),
    ) as { scripts?: Record<string, string> };
    const postinstall = pkg.scripts?.postinstall ?? "";

    expect(postinstall).not.toContain("|| true");
    expect(postinstall).toContain("node -e");
  });

  it("suppresses asynchronous failures inside the optional postinstall hook", async () => {
    await expect(
      runOptionalPostinstall(async () => {
        throw new Error("simulated postinstall failure");
      }),
    ).resolves.toBeUndefined();
  });
});
