/**
 * Global test isolation for the real ~/.gnosys (v5.13.0).
 *
 * In-process code (GnosysDB.openLocal, dream state read/write, dream lock)
 * resolves the central home via getGnosysHome(), which falls back to the
 * developer's real ~/.gnosys when GNOSYS_HOME is unset. That let
 * dream-resume.test.ts — which runs GnosysDreamEngine in-process — write
 * its 5-fixture watermark into the real dream-state.json on every
 * `npm test`, chronically suppressing scheduled Dream ("not dreamworthy
 * yet") on any dev machine that runs the suite.
 *
 * This setup file gives every vitest worker a throwaway GNOSYS_HOME before
 * any test module loads. Tests that need a specific home still set/restore
 * their own value (dream-run-log.test.ts, dream-coverage.test.ts), and the
 * CLI helpers in _helpers.ts always pass an explicit GNOSYS_HOME to
 * subprocesses — this only replaces the dangerous real-home default.
 */

import fs from "fs";
import os from "os";
import path from "path";

if (!process.env.GNOSYS_HOME) {
  // The throwaway home ends in ".gnosys" so path-shape assertions (e.g.
  // "sandbox dir lives under ~/.gnosys") hold exactly as they would for a
  // real home directory.
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-test-home-"));
  const home = path.join(base, ".gnosys");
  fs.mkdirSync(home, { recursive: true });
  process.env.GNOSYS_HOME = home;
}
