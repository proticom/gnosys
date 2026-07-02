/**
 * Guard for interactive prompt flows (v5.14.x sprint, pre-approved).
 *
 * Interactive setup flows crash with ERR_USE_AFTER_CLOSE when stdin is
 * closed (e.g. `gnosys setup dream` run non-interactively from a script
 * or CI). Instead of a stack trace, print a friendly one-line error and
 * exit 1.
 */

/** Returns true when stdin can host an interactive prompt session. */
export function stdinIsInteractive(): boolean {
  return Boolean(process.stdin.isTTY);
}

/** Human-readable message for a blocked interactive flow. */
export function nonInteractiveMessage(flow: string): string {
  return `gnosys ${flow} is interactive and requires a terminal (stdin is not a TTY). Re-run from an interactive shell.`;
}

/**
 * Exit with a friendly one-liner when stdin is not a TTY.
 * Call at the entry of interactive prompt flows, before any readline use.
 */
export function guardInteractiveStdin(flow: string): void {
  if (stdinIsInteractive()) return;
  console.error(nonInteractiveMessage(flow));
  process.exit(1);
}
