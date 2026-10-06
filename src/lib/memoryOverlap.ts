import type { GnosysDB } from "./db.js";

export function memoryOverlapWarning(
  db: GnosysDB,
  memory: { id: string; relevance: string; supersedes?: string; scope: string; projectId: string | null },
): string {
  if (!memory.relevance) return "";
  const excluded = new Set([memory.id, ...(memory.supersedes?.split(",").map((id) => id.trim()) ?? [])]);
  const overlaps = db.discoverFts(memory.relevance.split(" ").slice(0, 5).join(" "), 3 + excluded.size, true, {
    scope: memory.scope,
    projectId: memory.projectId,
  }).filter((result) => !excluded.has(result.id)).slice(0, 3);
  if (overlaps.length === 0) return "";
  return [
    "⚠️ Potential overlaps detected. Review these for contradictions:",
    ...overlaps.map((result) => `  - ${result.title} (${result.id})`),
    "Use gnosys_read to compare, then gnosys_update with supersedes/superseded_by if needed.",
  ].join("\n");
}
