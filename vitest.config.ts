import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
    // CLI integration tests cold-start `tsx src/cli.ts` which can take 10–15s.
    // The 5s default times out almost every CLI test. Keep tests serial too —
    // SQLite write contention from parallel workers caused flaky failures.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    // v5.13.0: isolate every worker from the developer's real ~/.gnosys.
    // In-process engine runs (dream-resume.test.ts) were writing their
    // fixture watermark into the real dream-state.json on every `npm test`,
    // chronically suppressing scheduled Dream on dev machines.
    setupFiles: ["src/test/_setupGnosysHome.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary", "html"],
      reportsDirectory: "coverage",
      include: ["src/lib/**/*.ts", "src/sandbox/**/*.ts"],
      exclude: [
        "src/test/**",
        "src/**/*.test.ts",
        "dist/**",
        "node_modules/**",

        // ── Exclude modules that require external services / interactive I/O ──
        // These can't be meaningfully unit tested — they call LLM APIs, spawn
        // processes, require user input, or process binary media files.

        // LLM provider calls (Anthropic, Ollama, Groq, OpenAI, LM Studio)
        "src/lib/llm.ts",

        // Interactive setup wizard (1700 lines of prompts + I/O)
        "src/lib/setup.ts",

        // v5.8.6: interactive section wizards under src/lib/setup/.
        // Same justification as setup.ts — readline-driven I/O, hard to
        // meaningfully unit-test, exercised via CLI integration tests.
        "src/lib/setup/**",

        // v5.13.0: thin CLI command wrappers extracted from cli.ts in the
        // 5.11 command-coverage sprint. They are exercised via `node
        // dist/cli.js` subprocess integration tests, which in-process V8
        // coverage cannot see — same rationale as the cli.ts exclusion
        // below. Moving ~3,600 statements from excluded cli.ts into
        // included lib/ silently dropped global coverage 63% → 46% and has
        // failed the CI gate on every master push since 2026-05-30.
        // Burn-down path: convert the string-assertion wiring tests into
        // import-and-invoke unit tests, then remove this exclusion.
        "src/lib/*Command.ts",

        // Media processing (requires binary files, external tools like Tesseract)
        "src/lib/multimodalIngest.ts",
        "src/lib/pdfExtract.ts",
        "src/lib/videoExtract.ts",

        // Maintenance / recall (require LLM or long-running scheduler)
        "src/lib/maintenance.ts",

        // Recall context injection (depends on LLM for summarization)
        "src/lib/recall.ts",

        // Sandbox process management (spawns background processes)
        "src/sandbox/manager.ts",
        "src/sandbox/index.ts",

        // Large entry points tested via CLI integration, not unit tests
        "src/cli.ts",
        "src/cli/**", // v6.2.1 cli split: registrations moved out of cli.ts, same rationale
        "src/index.ts",
      ],
      thresholds: {
        statements: 50,
        branches: 40,
        functions: 55,
        lines: 50,
      },
    },
  },
});
