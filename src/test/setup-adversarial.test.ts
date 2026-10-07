import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PTY_RELAY } from "./_pty-relay.js";

type WizardResult = { code: number | null; transcript: string; promptsAnswered: number };
type Finish = "interrupt-ides" | "complete";

async function driveSetup(finish: Finish): Promise<WizardResult> {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-setup-attack-"));
  const configDir = path.join(home, ".config", "gnosys");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(path.join(configDir, "models-cache.json"), "{}");
  try {
    return await new Promise<WizardResult>((resolve, reject) => {
      const child = spawn("python3", ["-u", "-c", PTY_RELAY, process.execPath, path.resolve("dist/cli.js"), "setup", "--full"], {
        cwd: home,
        env: { ...process.env, HOME: home, GNOSYS_HOME: path.join(home, ".gnosys"),
          GNOSYS_CONFIG_DIR: configDir, GNOSYS_LOCAL_ONLY: "1", GNOSYS_SKIP_UPGRADE_NUDGE: "1", FORCE_COLOR: "0" },
        stdio: ["pipe", "pipe", "pipe"],
      });
      let transcript = "";
      let cursor = 0;
      let promptsAnswered = 0;
      let timeout = false;
      const timer = setTimeout(() => { timeout = true; child.kill("SIGTERM"); }, 15_000);
      child.stdout.on("data", (data: Buffer) => {
        transcript += data.toString();
        const plain = transcript.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
        const screen = plain.slice(cursor);
        if (!/(?:^|[\r\n])> $/.test(screen)) return;
        if (promptsAnswered === 1 && finish === "interrupt-ides" && screen.includes("IDE Integration")) {
          promptsAnswered++;
          cursor = plain.length;
          child.stdin.write("\x03");
          return;
        }
        const option = screen.match(/(?:^|[\r\n])\s*(\d+)\. Skip(?: \(core memory works without LLM\))?\s*(?:[\r\n]|$)/);
        if (option && promptsAnswered < 2) {
          promptsAnswered++;
          cursor = plain.length;
          child.stdin.write(`${option[1]}\n`);
        }
      });
      child.stderr.on("data", (data: Buffer) => { transcript += data.toString(); });
      child.on("error", (error) => { clearTimeout(timer); reject(error); });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (timeout) reject(new Error(`Setup did not finish: ${transcript}`));
        else resolve({ code, transcript: transcript.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, ""), promptsAnswered });
      });
    });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

describe("setup exit status after the provider prompt", () => {
  it("G2-D001 Ctrl+C at IDE integration exits 130", async () => {
    const result = await driveSetup("interrupt-ides");
    expect(result.promptsAnswered, result.transcript).toBe(2);
    expect(result.transcript).toContain("IDE Integration");
    expect(result.transcript).toContain("cancelled");
    expect(result.code, result.transcript).toBe(130);
  });

  it("completes the interactive core-memory setup with exit 0", async () => {
    const result = await driveSetup("complete");
    expect(result.promptsAnswered, result.transcript).toBe(2);
    expect(result.transcript).toContain("Setup Complete");
    expect(result.transcript).toContain("Provider:");
    expect(result.transcript).not.toContain("cancelled");
    expect(result.code, result.transcript).toBe(0);
  });
});
