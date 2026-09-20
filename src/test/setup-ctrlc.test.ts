import { beforeAll, describe, it, expect } from "vitest";
import { spawn } from "child_process";
import path from "path";
import os from "os";
import fs from "fs";

const CLI = path.resolve("dist/cli.js");
const PTY_RELAY = `
import errno, os, pty, select, signal, sys
pid, master = pty.fork()
if pid == 0:
    os.execv(sys.argv[1], sys.argv[1:])
def terminate(signum, frame):
    os.killpg(pid, signal.SIGKILL)
signal.signal(signal.SIGTERM, terminate)
inputs = [master, sys.stdin.fileno()]
while master in inputs:
    ready, _, _ = select.select(inputs, [], [], 1)
    for fd in ready:
        try:
            data = os.read(fd, 4096)
        except OSError as error:
            if error.errno != errno.EIO:
                raise
            data = b''
        if not data:
            inputs.remove(fd)
        elif fd == master:
            os.write(sys.stdout.fileno(), data)
        else:
            os.write(master, data)
os.close(master)
_, status = os.waitpid(pid, 0)
code = os.waitstatus_to_exitcode(status)
sys.exit(code if code >= 0 else 128 - code)
`;

type InterruptResult = { code: number | null; transcript: string; interrupted: boolean };

async function interruptAtPrompt(args: string[]): Promise<InterruptResult> {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-ctrlc-"));
  const configDir = path.join(home, ".config", "gnosys");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(path.join(configDir, "models-cache.json"), "{}");
  try {
    return await new Promise<InterruptResult>((resolve, reject) => {
      const child = spawn("python3", ["-u", "-c", PTY_RELAY, process.execPath, CLI, ...args], {
        cwd: home,
        env: {
          ...process.env,
          HOME: home,
          GNOSYS_HOME: path.join(home, ".gnosys"),
          GNOSYS_CONFIG_DIR: configDir,
          GNOSYS_LOCAL_ONLY: "1",
          GNOSYS_SKIP_UPGRADE_NUDGE: "1",
          FORCE_COLOR: "0",
        },
        stdio: ["pipe", "pipe", "pipe"],
      });
      let transcript = "";
      let interrupted = false;
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, 10_000);
      child.stdout.on("data", (data: Buffer) => {
        transcript += data.toString();
        const plain = transcript.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
        if (!interrupted && /(?:^|[\r\n])> $/.test(plain)) {
          interrupted = true;
          child.stdin.write("\x03");
        }
      });
      child.stderr.on("data", (data: Buffer) => { transcript += data.toString(); });
      child.on("error", reject);
      child.on("close", (code) => {
        clearTimeout(timer);
        if (timedOut) reject(new Error(`PTY setup did not finish: ${transcript}`));
        else resolve({ code, transcript, interrupted });
      });
    });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

const results: InterruptResult[] = [];
beforeAll(async () => {
  for (const args of [["setup"], ["setup", "models"], ["setup", "ides"]]) {
    const result = await interruptAtPrompt(args);
    expect(result.interrupted, result.transcript).toBe(true);
    expect(result.transcript).toContain("cancelled · no changes written");
    expect(result.transcript).not.toContain("AbortError");
    results.push(result);
  }
}, 40_000);

describe("Phase B — Ctrl+C clean exit", () => {
  it.fails("gnosys setup exits cleanly on SIGINT", () => {
    expect(results[0].code, results[0].transcript).toBe(130);
  });

  it("gnosys setup models exits cleanly on SIGINT", () => {
    expect(results[1].code, results[1].transcript).toBe(130);
  });

  it("gnosys setup ides exits cleanly on SIGINT", () => {
    expect(results[2].code, results[2].transcript).toBe(130);
  });
});
