/**
 * v13 multi-machine wizard — pure helpers (no readline).
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  matchesTypedPhrase,
  detectClonedStagingPresence,
  BACKUP_RISK_PHRASE,
  __test,
} from "../lib/remoteWizard.js";
import {
  renderV13ExplanationScreen,
  renderMasterBackupWarning,
  renderBackupDeclineAckPrompt,
  BACKUP_DECLINE_ACK_INSTRUCTION,
  BACKUP_RISK_PHRASE as RENDER_PHRASE,
} from "../lib/setup/remoteRender.js";

describe("remoteWizard v13 helpers", () => {
  it("matchesTypedPhrase requires exact match after trim", () => {
    expect(matchesTypedPhrase(BACKUP_RISK_PHRASE, BACKUP_RISK_PHRASE)).toBe(true);
    expect(matchesTypedPhrase(`  ${BACKUP_RISK_PHRASE}  `, BACKUP_RISK_PHRASE)).toBe(true);
    expect(matchesTypedPhrase("wrong", BACKUP_RISK_PHRASE)).toBe(false);
    expect(__test.matchesTypedPhrase).toBe(matchesTypedPhrase);
  });

  it("detectClonedStagingPresence uses the per-client presence file", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-wiz-"));
    try {
      const machineId = "01TESTMACHINE000000000000";
      expect(detectClonedStagingPresence(tmp, machineId)).toBe(false);
      const presence = __test.clientPresencePath(tmp, machineId);
      fs.mkdirSync(path.dirname(presence), { recursive: true });
      fs.writeFileSync(presence, JSON.stringify({ machineId }));
      expect(detectClonedStagingPresence(tmp, machineId)).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("BACKUP_RISK_PHRASE is shared with remoteRender", () => {
    expect(BACKUP_RISK_PHRASE).toBe(RENDER_PHRASE);
  });
});

describe("remoteWizard v13 render screens", () => {
  function strip(s: string): string {
    // eslint-disable-next-line no-control-regex
    return s.replace(/\x1b\[[0-9;]*m/g, "");
  }

  it("renderV13ExplanationScreen includes key v13 rules", () => {
    const out = strip(renderV13ExplanationScreen());
    expect(out).toContain("Multi-machine sync");
    expect(out).toContain("master folder is reachable");
    expect(out).toContain("master folder is NOT reachable");
    expect(out).toContain("Old memories cannot be read");
    expect(out).toContain("Tailscale");
  });

  it("renderMasterBackupWarning includes daily snapshot copy", () => {
    const out = strip(renderMasterBackupWarning());
    expect(out).toContain("ONLY copy of your brain");
    expect(out).toContain("master-folder/backups");
  });

  it("renderBackupDeclineAckPrompt requires the v13 typed phrase", () => {
    const out = strip(renderBackupDeclineAckPrompt());
    expect(out).toContain(BACKUP_DECLINE_ACK_INSTRUCTION);
    expect(out).toContain("I ACCEPT THE RISK OF DATA LOSS WITHOUT BACKUPS");
    expect(out).toContain(BACKUP_RISK_PHRASE);
  });
});
