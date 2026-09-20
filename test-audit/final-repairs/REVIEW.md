# Final selected-ID and routing-reset QA

Application commits `5834a4b` and `518785a` repair D-VSC-001 and DEF-G1-001. QA changes only ten `it.fails` declarations to `it`, covering twenty runtime cases. Every assertion and the complete v584 test file remain unchanged. [Marker integrity](marker-integrity.json).

All 43 focused extension, routing and v584 cases pass. The extension resolves a fresh selected frontmatter ID, preserves unrelated decoy records, sends the useful signal as literal argv, accepts nested exact memory directories with both separator styles, and warns without launching for missing, empty and body-only IDs. Hostile filename cases preserve the selected identity and create no shell execution markers. Native VS Code and native Windows are not exercised. [Focused run](unit.json).

Routing reset removes all local overrides. Reset followed by editing retains only the new override. Serialized unrelated configuration values, including llm and dream, remain identical. This asserts preservation of values, not source whitespace. The unchanged v584 tests still protect generic deep merging. The application reports inherited global overrides; these four repair cases do not independently verify that warning.

Fault replay restores the old reset and makes all four routing cases fail. Dropping Dream configuration makes both preservation cases fail. Extension faults substitute a constant ID, launch without a readable ID, change the useful signal, weaken directory matching, invoke a removed dashboard command, hide process errors, and restore shell transport. Each fault must fail ordinary assertions and pass after restoration; unexpected inverse-repair passes receive no protection credit. [Extension faults](../mutations/release.final-vscode.results.json), [routing faults](../mutations/release.final-routing.results.json).

The prior repair replay is retained at the current application digest for acceptance reconciliation. Historical results retain their original revisions. CI script faults are unchanged and are not rerun in this pass. [Previous application faults](../mutations/release.final-previous.results.json).

Three application defects remain open: ADV-CTX-001 exposes a stored custom-provider key in JSON config output; D-DASH-001 allows stored project-name script execution in generated dashboard handlers; ADV-FTS-001 recreates a lost central FTS index without its stored content. D-G3-001 remains DEFERRED. Their four expected-failure cases remain in the suite.

Typecheck, lint and Knip pass. [Static checks](static-checks.json). The full suite passes all 1,746 cases with four expected failures and zero unexpected failures or skips. Strict reconciliation has zero missing kills, survival proofs, unmapped cases or acceptance issues. [Full suite](full-suite.json), [ledger](../ledger.json). Linux/Node24.18.1 coverage is a separate release prerequisite; this local review does not claim it has passed.

The unchanged 100 ms memory-read and 50 ms FTS assertions remain hosted-runner flake risks. The measured Node24.20/24.21 native statement-cleanup abort is tracked separately by the diagnostic workflow. Full-suite and coverage runs must omit the exit-logging preload because it changes captured subprocess stderr. Node20/22 jobs, assertions and coverage gates remain intact after the CI pin to Node24.18.1.
