#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

const [dbFile, runsFile] = process.argv.slice(2);
if (!dbFile || !runsFile) {
  throw new Error("Usage: node scripts/dream-health-census.mjs <copy.db> <dream-runs.jsonl>");
}
const resolvedDb = fs.realpathSync(dbFile);
if (resolvedDb.startsWith(path.join(os.homedir(), ".gnosys") + path.sep)) {
  throw new Error("Use a database copy outside ~/.gnosys.");
}
const db = new Database(resolvedDb, { readonly: true, fileMustExist: true });
try {
  const runs = fs.readFileSync(runsFile, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
  const counts = (values) => Object.fromEntries(
    [...new Set(values)].sort().map((value) => [value, values.filter((v) => v === value).length]),
  );
  const total = (key) => runs.reduce((sum, run) => sum + (run.effectiveness?.[key] ?? 0), 0);
  const calls = runs.flatMap((run) => run.llmCalls ?? []);
  const reviews = runs.filter((run) => Array.isArray(run.reviewSuggestions));
  const summaries = db.prepare("SELECT scope_key, source_ids, modified FROM summaries WHERE scope = 'category'").all();
  const categories = db.prepare("SELECT category, count(*) AS memories FROM memories WHERE tier = 'active' GROUP BY category ORDER BY category").all();
  console.log(JSON.stringify({
    database: {
      memories: db.prepare("SELECT count(*) AS total, sum(tier = 'active' AND status = 'active') AS active, sum(embedding IS NOT NULL) AS embedded FROM memories").get(),
      categories,
      summaries: summaries.map((summary) => ({
        category: summary.scope_key,
        sources: JSON.parse(summary.source_ids).length,
        modified: summary.modified,
      })),
      relationships: db.prepare("SELECT rel_type, count(*) AS count FROM relationships GROUP BY rel_type ORDER BY rel_type").all(),
    },
    history: {
      runs: runs.length,
      statuses: counts(runs.map((run) => run.status)),
      summariesGenerated: total("summariesGenerated"),
      summariesUpdated: total("summariesUpdated"),
      relationshipsDiscovered: total("relationshipsDiscovered"),
      errors: counts(runs.flatMap((run) => run.errors ?? [])),
      llmCalls: counts(calls.map((call) => call.status)),
      skipReasons: counts(calls.filter((call) => call.status === "skipped").map((call) => `${call.phase}: ${call.reason}`)),
      reviewSnapshots: reviews.map((run) => ({ startedAt: run.startedAt, count: run.reviewSuggestions.length })),
    },
  }, null, 2));
} finally {
  db.close();
}
