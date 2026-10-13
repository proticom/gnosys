/**
 * Memory deletion always needs a human (Edward, 2026-10-13: "an agent can
 * run everything as long as it doesn't delete memories").
 *
 * GnosysDB.deleteMemory and GnosysDB.restore call assertMemoryDeletionAllowed
 * before touching rows, so every caller passes through this one check. A
 * deletion proceeds only when:
 *   1. the process is not an agent surface (MCP server, sandbox socket), AND
 *   2. a human typed the key or memory id at an interactive terminal
 *      (confirmMemoryDeletion registers a one-shot grant per target), OR
 *      the human-only override env var is set.
 *
 * The prompt lives here rather than in deleteMemory because deleteMemory is
 * synchronous and may run inside a better-sqlite3 transaction.
 */

import { createInterface } from "readline/promises";

/** Set by a human, never by an agent. Ignored on agent surfaces. */
export const MEMORY_DELETE_OVERRIDE_ENV = "GNOSYS_ALLOW_MEMORY_DELETE";

const ALTERNATIVE =
  "Mark it superseded or archived instead (gnosys update <id> --status superseded|archived, or MCP gnosys_update).";

export type MemoryDeletionRefusalReason =
  | "agent-surface"
  | "no-terminal"
  | "not-confirmed"
  | "no-confirmation";

export class MemoryDeletionRefusedError extends Error {
  readonly code = "MEMORY_DELETE_REFUSED";
  constructor(
    readonly reason: MemoryDeletionRefusalReason,
    readonly target: string,
  ) {
    super(refusalMessage(reason, target));
    this.name = "MemoryDeletionRefusedError";
  }
}

function refusalMessage(reason: MemoryDeletionRefusalReason, target: string): string {
  switch (reason) {
    case "agent-surface":
      return `Refused to delete "${target}": agents can never delete memories. ${ALTERNATIVE}`;
    case "no-terminal":
      return `Refused to delete "${target}": memory deletion needs a human at an interactive terminal to type the key. ${ALTERNATIVE}`;
    case "not-confirmed":
      return `Did not delete "${target}": the typed confirmation did not match.`;
    case "no-confirmation":
      return `Refused to delete "${target}": no human typed a confirmation for it. ${ALTERNATIVE}`;
  }
}

let agentSurface: string | null = null;
const grants = new Set<string>();

/** Called once by processes that serve agents (MCP server, sandbox socket). */
export function markAgentSurface(name: string): void {
  agentSurface = name;
}

function overrideSet(): boolean {
  return process.env[MEMORY_DELETE_OVERRIDE_ENV] === "1";
}

/**
 * Synchronous boundary check. Consumes the one-shot grant for `target` when
 * one exists. Throws MemoryDeletionRefusedError otherwise.
 */
export function assertMemoryDeletionAllowed(target: string): void {
  if (agentSurface) throw new MemoryDeletionRefusedError("agent-surface", target);
  if (grants.delete(target)) return;
  if (overrideSet()) return;
  throw new MemoryDeletionRefusedError(process.stdin.isTTY ? "no-confirmation" : "no-terminal", target);
}

export interface ConfirmMemoryDeletionRequest {
  /** What the human must type to confirm (a preference key, memory id, project id, file name). */
  confirmText: string;
  /** Targets the confirmation covers: memory ids, or the restore source path. */
  targets: readonly string[];
  /** One line describing what will be deleted, shown above the prompt. */
  summary: string;
  /** Reuse the caller's open readline instead of opening a second one on stdin. */
  ask?: (question: string) => Promise<string>;
}

/**
 * Ask the human to confirm a deletion. Resolves when the deletion may
 * proceed; throws MemoryDeletionRefusedError when it may not. Never prompts
 * on an agent surface or without a terminal.
 */
export async function confirmMemoryDeletion(req: ConfirmMemoryDeletionRequest): Promise<void> {
  if (agentSurface) throw new MemoryDeletionRefusedError("agent-surface", req.confirmText);
  if (overrideSet()) return;
  if (!process.stdin.isTTY) throw new MemoryDeletionRefusedError("no-terminal", req.confirmText);

  process.stderr.write(`${req.summary}\n`);
  const question = `Type "${req.confirmText}" to delete permanently (anything else cancels): `;
  let answer: string;
  if (req.ask) {
    answer = await req.ask(question);
  } else {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    try {
      answer = await rl.question(question);
    } finally {
      rl.close();
    }
  }
  if (answer.trim() !== req.confirmText) {
    throw new MemoryDeletionRefusedError("not-confirmed", req.confirmText);
  }
  for (const t of req.targets) grants.add(t);
}
