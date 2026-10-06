import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export type EmbeddingRuntimeStatus =
  | { kind: "available" }
  | { kind: "unavailable"; message: string };

const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const quotedRoot = `'${packageRoot.replaceAll("'", "'\\''")}'`;
export const EMBEDDING_INSTALL_HINT =
  `npm install @huggingface/transformers@^4.2.0 --prefix ${quotedRoot} --no-save --package-lock=false --foreground-scripts`;

export class EmbeddingUnavailableError extends Error {}

export function embeddingFailureMessage(error?: unknown): string {
  const detail = error instanceof Error ? ` Runtime error: ${error.message}` : "";
  return `Local embeddings require a working @huggingface/transformers installation.${detail} Install it with: ${EMBEDDING_INSTALL_HINT}. Then run gnosys doctor and gnosys reindex.`;
}

/** Resolves the package without loading native code or downloading a model. */
export function checkEmbeddingPackage(): EmbeddingRuntimeStatus {
  try {
    createRequire(import.meta.url).resolve("@huggingface/transformers");
    return { kind: "available" };
  } catch {
    return { kind: "unavailable", message: embeddingFailureMessage() };
  }
}

/** Loads the runtime so doctor also detects broken native dependencies. */
export async function checkEmbeddingRuntime(): Promise<EmbeddingRuntimeStatus> {
  try {
    await import("@huggingface/transformers");
    return { kind: "available" };
  } catch (error) {
    return { kind: "unavailable", message: embeddingFailureMessage(error) };
  }
}
