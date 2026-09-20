# Release context QA

Validated QA checkout `5dac0725bde036e1eea5689ed1977d23b73a364f`, application `e9d605f66268a6599c6064d54bc4df6f4f094369`, in `/private/tmp/gnosys-release-context` with Node22. Application digest is `e5fde6e407d5f212260c04c748ad8d21f73f57ef99db2518b3ca21d2cf8ea693`. No application changes or commits were retained.

Both normal CLI/MCP bulk imports pass their existing literal reopened-database assertions as ordinary tests. Only their two `it.fails` markers changed. The custom local HTTP provider and actual CLI/MCP boundaries remain intact.

The existing four-file context/provider/dedup/config unit has26 passed, zero failed and zero skipped, with one expected failure. Typecheck and edited-file Biome pass. All13 prior context faults plus two caller-specific persistence faults are killed, covering19 distinct ordinary cases. Every before/restored selection passes and every application mutation restores exactly.

ADV-CTX-001 remains open. Actual `config show --json` exposes the fake stored provider key; config bytes are unchanged. Its test and expected-failure annotation are untouched. Run `node test-audit/release-review/release-context-config-repro.mjs` for a fresh temporary report, or add `--output /tmp/config-release-new.json` for a chosen new path. It refuses to overwrite evidence.

The test patch is `release-context-tests.patch`. `release-context-final.json` lists all26 exact outcomes and file hashes. `release-context-actions.json` maps both promoted markers to their direct fault IDs. Specs/results, feature limits, defect status and artifact hashes are adjacent under the same prefix. These results cover this owned unit; the parent owns integrated full-suite validation.
