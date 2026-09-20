/**
 * Gnosys VS Code Extension — Stub
 *
 * This is a minimal extension stub that demonstrates how to integrate
 * Gnosys with VS Code. Community contributions welcome!
 *
 * Commands:
 *   - Gnosys: Reinforce Memory — increments reinforcement_count on the
 *     currently open .md file if it's inside a .gnosys/ directory.
 *   - Gnosys: Show Dashboard — runs `gnosys status --system` in the terminal.
 */

const vscode = require("vscode");
const { execFileSync } = require("child_process");
const path = require("path");

function activate(context) {
  // Command: Reinforce the currently open memory file
  const reinforceCmd = vscode.commands.registerCommand(
    "gnosys.reinforceMemory",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active editor.");
        return;
      }

      const filePath = editor.document.uri.fsPath;

      // Check if we're inside a .gnosys directory
      const memoryDirectory = /(?:^|[\\/])\.gnosys(?:[\\/]|$)/.exec(filePath);
      if (!memoryDirectory) {
        vscode.window.showWarningMessage(
          "This file is not inside a .gnosys/ directory."
        );
        return;
      }

      // Find the .gnosys root
      const gnosysIndex = memoryDirectory.index + memoryDirectory[0].indexOf(".gnosys");
      const storePath = filePath.substring(0, gnosysIndex + ".gnosys".length);
      let memoryId;
      try {
        const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(editor.document.getText());
        const identity = frontmatter && /^id:[ \t]*(?:"([^"\r\n]+)"|'([^'\r\n]+)'|([^\s"'#][^\r\n]*?))[ \t]*(?:#.*)?$/m.exec(frontmatter[1]);
        memoryId = identity && (identity[1] ?? identity[2] ?? identity[3]).trim();
      } catch {
        memoryId = undefined;
      }
      if (!memoryId) {
        vscode.window.showWarningMessage("This document has no readable memory ID in its frontmatter.");
        return;
      }

      try {
        execFileSync("npx", ["gnosys", "reinforce", memoryId, "--signal", "useful"], {
          cwd: path.dirname(storePath.replaceAll("\\", path.sep)),
          timeout: 10000,
        });
        vscode.window.showInformationMessage(
          `Reinforced: ${path.basename(filePath)}`
        );
      } catch (err) {
        vscode.window.showErrorMessage(
          `Reinforce failed: ${err.message || err}`
        );
      }
    }
  );

  // Command: Show dashboard in terminal
  const dashboardCmd = vscode.commands.registerCommand(
    "gnosys.runDashboard",
    () => {
      const terminal = vscode.window.createTerminal("Gnosys Dashboard");
      terminal.show();
      terminal.sendText("npx gnosys status --system");
    }
  );

  context.subscriptions.push(reinforceCmd, dashboardCmd);
}

function deactivate() {}

module.exports = { activate, deactivate };
