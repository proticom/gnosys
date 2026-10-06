import type { GnosysDB } from "./db.js";

export function memoryOverlapWarning(
  db: GnosysDB,
  memory: { id: string; relevance: string; supersedes?: string },
): string {
  if (!memory.relevance) return "";
  const overlaps = db.discoverFts(memory.relevance.split(" ").slice(0, 5).join(" "), 5, true)
    .filter((result) => result.id !== memory.id && result.id !== memory.supersedes);
  if (overlaps.length === 0) return "";
  return [
    "⚠️ Potential overlaps detected. Review these for contradictions:",
    ...overlaps.slice(0, 3).map((result) => `  - ${result.title} (${result.id})`),
    "Use gnosys_read to compare, then gnosys_update with supersedes/superseded_by if needed.",
  ].join("\n");
}
