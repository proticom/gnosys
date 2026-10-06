import { z } from "zod";

export function formatDreamError(error: unknown): string {
  const message = error instanceof z.ZodError
    ? error.issues.map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`).join("; ")
    : error instanceof Error ? error.message : String(error);
  const line = message.replace(/\s+/g, " ").trim();
  return line.length > 300 ? `${line.slice(0, 297)}...` : line;
}

export function boundedDreamMessages(messages: unknown[]): string[] {
  return messages.filter((message): message is string => typeof message === "string")
    .slice(0, 20).map(formatDreamError);
}
