const fs = require("node:fs");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");

const [extensionPath, command, activeFile] = process.argv.slice(2);
const result = { warnings: [], information: [], errors: [], terminals: [] };
const commands = new Map();
const vscode = {
  commands: {
    registerCommand(name, callback) {
      commands.set(name, callback);
      return { dispose() {} };
    },
  },
  window: {
    activeTextEditor: activeFile ? { document: { uri: { fsPath: activeFile } } } : undefined,
    showWarningMessage(message) { result.warnings.push(message); },
    showInformationMessage(message) { result.information.push(message); },
    showErrorMessage(message) { result.errors.push(message); },
    createTerminal(name) {
      const entry = { name, shown: false, runs: [] };
      result.terminals.push(entry);
      return {
        show() { entry.shown = true; },
        sendText(text) {
          const child = spawnSync(text, { shell: true, encoding: "utf8", timeout: 10_000 });
          entry.runs.push({ command: text, status: child.status, stdout: child.stdout, stderr: child.stderr });
        },
      };
    },
  },
};
const moduleUnderTest = { exports: {} };
const load = new vm.Script(`(function(require, module, exports) {\n${fs.readFileSync(extensionPath, "utf8")}\n})`, { filename: extensionPath }).runInThisContext();
load((name) => name === "vscode" ? vscode : require(name), moduleUnderTest, moduleUnderTest.exports);
moduleUnderTest.exports.activate({ subscriptions: [] });
Promise.resolve(commands.get(command)()).then(() => process.stdout.write(JSON.stringify(result)));
