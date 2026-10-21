import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

type Hints = Required<Pick<ToolAnnotations,
  "readOnlyHint" | "destructiveHint" | "idempotentHint" | "openWorldHint"
>>;

// readOnlyHint means no user-visible data/config/file changes. Incidental
// derived-index/cache refreshes and access/audit logs are excluded.
// Explicit embedding reindex is write-capable.
// destructiveHint covers overwriting, archiving, merging, or deleting existing
// user data; additive writes and feedback are non-destructive.
// idempotentHint means identical calls add no further user-visible effects.
// openWorldHint covers provider calls, explicit NAS operations, arbitrary
// caller paths, and potential Hugging Face downloads on first embedding use.
// Incidental NAS snapshot refresh remains excluded from open-world hints.
export const TOOL_ANNOTATIONS = {
  gnosys_add: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  gnosys_add_structured: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  gnosys_ask: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  gnosys_attach: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  gnosys_audit: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_bootstrap: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  gnosys_briefing: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_commit_context: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  gnosys_dashboard: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  gnosys_dearchive: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  gnosys_detect_ambiguity: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_discover: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_dream: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  gnosys_export: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  gnosys_federated_search: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_get_attachment: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  gnosys_graph: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_history: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_hybrid_search: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  gnosys_import: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  gnosys_ingest_file: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  gnosys_init: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  gnosys_lens: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_links: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_list: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_maintain: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  gnosys_migrate: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  gnosys_portfolio: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_preference_delete: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_preference_get: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_preference_set: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  gnosys_read: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_recall: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_reflect: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  gnosys_reindex: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  gnosys_reindex_graph: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_reinforce: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  gnosys_remote_pull: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  gnosys_remote_push: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  gnosys_remote_resolve: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  gnosys_remote_status: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  gnosys_search: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_semantic_search: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  gnosys_stale: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_stats: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_stores: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_sync: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  gnosys_tags: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_tags_add: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_timeline: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_toolset: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_trace: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  gnosys_traverse: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_update: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  gnosys_update_status: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  gnosys_working_set: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
} satisfies Record<string, Hints>;

export type ToolName = keyof typeof TOOL_ANNOTATIONS;
