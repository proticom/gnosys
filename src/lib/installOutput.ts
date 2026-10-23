/** Filter the optional embedding runtime's known npm deprecation warning. */

/** Transitive packages whose deprecation warning we knowingly suppress. */
export const SUPPRESSED_DEPRECATED_PACKAGES = ["boolean"];

/** True if `line` is one of the known-benign npm deprecation warnings. */
export function isSuppressedNpmLine(line: string): boolean {
  if (!/npm warn deprecated/i.test(line)) return false;
  return SUPPRESSED_DEPRECATED_PACKAGES.some((pkg) => line.includes(`deprecated ${pkg}@`));
}

export interface NpmStderrFilter {
  /** Feed a raw stderr chunk; complete non-suppressed lines are written out. */
  feed(chunk: string): void;
  /** Flush any trailing partial line at process end. */
  end(): void;
}

/**
 * Line-buffered stderr filter. npm streams warnings as it resolves the tree, so
 * we buffer partial lines across chunks, drop the suppressed ones, and forward
 * everything else immediately (no waiting for the whole install to finish).
 */
export function makeNpmStderrFilter(write: (text: string) => void): NpmStderrFilter {
  let leftover = "";
  return {
    feed(chunk: string): void {
      leftover += chunk;
      const lines = leftover.split("\n");
      // The last element is an incomplete line (no trailing newline yet).
      leftover = lines.pop() ?? "";
      for (const line of lines) {
        if (!isSuppressedNpmLine(line)) write(`${line}\n`);
      }
    },
    end(): void {
      if (leftover.length > 0) {
        if (!isSuppressedNpmLine(leftover)) write(leftover);
        leftover = "";
      }
    },
  };
}
