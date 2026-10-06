import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateDreamDashboardHtml } from "../lib/dreamReport.js";
import { createSkipRunRecord, readDreamRuns } from "../lib/dreamRunLog.js";

let directory: string;
let previousHome: string | undefined;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "dream-report-items-"));
  previousHome = process.env.GNOSYS_HOME;
  process.env.GNOSYS_HOME = directory;
});

afterEach(() => {
  if (previousHome === undefined) delete process.env.GNOSYS_HOME;
  else process.env.GNOSYS_HOME = previousHome;
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("Dream report suggestion validation", () => {
  it("renders valid suggestions beside malformed persisted items", () => {
    const run = createSkipRunRecord({
      trigger: "scheduled", startedAt: "2026-10-06T02:00:00Z", provider: "test", gates: [], reason: "fixture",
    });
    const valid = {
      memoryId: "keep-001", title: "Keep this review", reason: "Confirm the deployment date",
      currentConfidence: 0.4, suggestedAction: "review",
    };
    fs.writeFileSync(path.join(directory, "dream-runs.jsonl"), `${JSON.stringify({
      ...run,
      phases: [{ name: "critique", status: "ran", memoryIdsTouched: [], llmCallsMade: 1, llmCallsSkipped: 0 }],
      reviewSuggestions: [
        { ...valid, memoryId: "bad-action", suggestedAction: "erase" },
        valid,
        { ...valid, memoryId: "bad-confidence", currentConfidence: "low" },
        null,
      ],
    })}\n`);

    const html = generateDreamDashboardHtml(readDreamRuns());
    expect(html).toContain("Showing 1 of 1 suggestions, lowest confidence first.");
    expect(html).toContain("<td><code>keep-001</code><br>Keep this review</td>");
    expect(html).toContain("<td>0.40</td>");
    expect(html).toContain("<td>Confirm the deployment date</td>");
    expect(html.includes("bad-action")).toBe(false);
    expect(html.includes("bad-confidence")).toBe(false);
  });
});
