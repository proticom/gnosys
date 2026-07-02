/**
 * `gnosys recall-hook` — Claude Code hook entry point (v5.14.0).
 *
 * This is what makes "automatic memory injection" real: Claude Code never
 * auto-reads MCP resources, but its hooks contract
 * (code.claude.com/docs/en/hooks.md) adds a hook's plain stdout to the
 * model context on exit 0. `gnosys init` wires this command into
 * UserPromptSubmit (every prompt, query = the prompt text) and
 * SessionStart (startup/resume/compact, wildcard = top memories).
 *
 * Contract obligations:
 *  - FAST: runs on every prompt. DB fast path only — no file stores, no
 *    embeddings, no model loads. (~150ms cold including node startup.)
 *  - NEVER breaks the prompt: always exit 0; every failure is silent.
 *  - Empty stdout when there is nothing to inject (no noise strings).
 *  - Output stays well under the 10,000-char hook cap.
 */

export type HookEvent = {
  hook_event_name?: string;
  prompt_text?: string;
  /** Older docs name the field `prompt`; accept both. */
  prompt?: string;
  source?: string;
  cwd?: string;
};

/** Max chars of the user prompt used as the recall query. */
const MAX_QUERY_CHARS = 400;
/** Keep comfortably under Claude Code's 10k hook-output cap. */
const MAX_OUTPUT_CHARS = 8_000;

/** Parse the hook event JSON into a recall query ("*" = top memories). */
export function hookQueryFromStdin(raw: string): string {
  try {
    const evt = JSON.parse(raw) as HookEvent;
    const prompt = evt.prompt_text ?? evt.prompt;
    if (typeof prompt === "string" && prompt.trim().length > 0) {
      return prompt.trim().slice(0, MAX_QUERY_CHARS);
    }
  } catch {
    // Not JSON (manual invocation / future contract change) — wildcard.
  }
  return "*";
}

async function readStdin(timeoutMs: number): Promise<string> {
  if (process.stdin.isTTY) return "";
  return new Promise((resolve) => {
    let data = "";
    const timer = setTimeout(() => resolve(data), timeoutMs);
    timer.unref?.();
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      clearTimeout(timer);
      resolve(data);
    });
    process.stdin.on("error", () => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

export async function runRecallHookCommand(opts: { limit?: string } = {}): Promise<void> {
  try {
    const raw = await readStdin(1_000);
    const query = hookQueryFromStdin(raw);

    const { resolveClientRead } = await import("./clientReadResolve.js");
    const clientRead = resolveClientRead();
    if (!clientRead) return; // no central DB — inject nothing, exit 0

    try {
      const { recall, formatRecall } = await import("./recall.js");
      const result = await recall(query, {
        limit: opts.limit ? parseInt(opts.limit, 10) : undefined,
        gnosysDb: clientRead.db,
        pendingOverlay: clientRead.pendingOverlay,
        traceId: "claude-code-hook",
      });

      if (result.memories.length === 0) return; // empty stdout = no injection

      const block = formatRecall(result);
      process.stdout.write(
        block.length > MAX_OUTPUT_CHARS ? `${block.slice(0, MAX_OUTPUT_CHARS)}\n</gnosys-recall>\n` : `${block}\n`
      );
    } finally {
      clientRead.release();
    }
  } catch {
    // Never fail the user's prompt over memory recall.
  }
}
