import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import ts from "typescript";

// Data joins: original declaration ID -> action -> exact file/runtime name -> current declaration.
// AST structure ignores comments/formatting; they do not establish semantic equivalence.
const args = process.argv.slice(2);
const options = { cwd: process.cwd(), base: "203c4e7", strict: false };
for (let index = 0; index < args.length; index++) {
  const key = args[index];
  if (key === "--help") {
    process.stdout.write("Usage: node scripts/test-audit-reconcile.mjs [--cwd DIR] [--base REF] [--runtime REPORT.json] [--baseline-runtime REPORT.json] [--output FILE.json] [--strict]\nWithout --runtime, reads ledger.runtimeRows. Without --output, writes JSON to stdout. Reads source/metadata only; never repairs classifications.\n");
    process.exit(0);
  }
  if (key === "--strict") options.strict = true;
  else if (["--cwd", "--base", "--runtime", "--baseline-runtime", "--output"].includes(key) && args[index + 1]) {
    options[key.slice(2)] = args[++index];
  } else throw new Error(`Unknown or incomplete argument: ${key}`);
}
const root = path.resolve(options.cwd);
const resolve = (file) => path.resolve(root, file);
const read = (file) => JSON.parse(fs.readFileSync(resolve(file), "utf8"));
const git = (...arguments_) => execFileSync("git", arguments_, { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const hash = (text) => createHash("sha256").update(text).digest("hex");
const classes = new Set(["STRONG", "WEAK", "HOLLOW", "COUPLED", "DEAD", "MISLABELED"]);
const changedActions = new Set(["rewritten", "added", "expected_failure"]);
const issues = {};
const issue = (kind, value) => (issues[kind] ||= []).push(value);
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const caseKey = (file, name) => JSON.stringify([file, name]);
const relative = (file) => {
  const normalized = file.replaceAll("\\", "/");
  if (!path.isAbsolute(normalized)) return normalized.replace(/^\.\//, "");
  const rel = path.relative(root, normalized).replaceAll("\\", "/");
  if (!rel.startsWith("../")) return rel;
  // Baseline reports can come from the original checkout or another isolated worktree.
  const marker = normalized.lastIndexOf("/src/");
  return marker >= 0 ? normalized.slice(marker + 1) : rel;
};
function fingerprint(node) {
  function structure(current) {
    const children = [];
    ts.forEachChild(current, (child) => { children.push(structure(child)); });
    return [current.kind, typeof current.text === "string" ? current.text : null, children];
  }
  return hash(JSON.stringify(structure(node)));
}
function shape(node, source, parameterized) {
  if (ts.isStringLiteralLike(node)) {
    let pattern = "";
    const text = node.text;
    const placeholders = parameterized ? /%%|%[sdifjo#$]|\$[A-Za-z_][\w.]*/g : /$^/g;
    let previous = 0;
    for (const match of text.matchAll(placeholders)) {
      pattern += escape(text.slice(previous, match.index));
      pattern += match[0] === "%%" ? "%" : "[\\s\\S]*?";
      previous = match.index + match[0].length;
    }
    return { text, pattern: pattern + escape(text.slice(previous)), dynamic: previous > 0 };
  }
  if (ts.isTemplateExpression(node)) {
    return {
      text: node.getText(source), dynamic: true,
      pattern: escape(node.head.text) + node.templateSpans.map((span) => "[\\s\\S]*?" + escape(span.literal.text)).join(""),
    };
  }
  return { text: node.getText(source), pattern: null, dynamic: true };
}
function declarations(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const aliases = new Map(["it", "test", "describe", "suite"].map((name) => [name, name]));
  const namespaces = new Set();
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node) || node.moduleSpecifier.text !== "vitest") continue;
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const item of bindings.elements) aliases.set(item.name.text, item.propertyName?.text || item.name.text);
    } else if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
  }
  function rootName(node) {
    if (ts.isIdentifier(node)) return aliases.get(node.text) || "";
    if (ts.isPropertyAccessExpression(node)) {
      if (ts.isIdentifier(node.expression) && namespaces.has(node.expression.text)) return node.name.text;
      return rootName(node.expression);
    }
    if (ts.isCallExpression(node) || ts.isTaggedTemplateExpression(node)) return rootName(node.expression || node.tag);
    return "";
  }
  const result = [];
  function visit(node, suites = []) {
    if (ts.isCallExpression(node)) {
      const kind = rootName(node.expression);
      const callback = node.arguments.find((argument) => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument));
      const declaration = node.expression.getText(source);
      const pending = !callback && /\.(?:todo|skip)$/.test(declaration) && node.arguments.length === 1;
      if (node.arguments[0] && (callback || pending) && ["describe", "suite", "it", "test"].includes(kind)) {
        const title = shape(node.arguments[0], source, /\.each\b/.test(declaration));
        if (["describe", "suite"].includes(kind)) {
          if (callback) ts.forEachChild(callback.body, (child) => visit(child, [...suites, title]));
          return;
        }
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        const names = [...suites, title];
        result.push({
          id: `${file}:${line}`, file, line, name: title.text, suites: suites.map((suite) => suite.text),
          sourceName: names.map((name) => name.text).join(" "),
          runtimePattern: names.every((name) => name.pattern !== null) ? `^${names.map((name) => name.pattern).join(" ")}$` : null,
          dynamicName: names.some((name) => name.dynamic),
          bodyHash: callback ? fingerprint(callback) : null,
          registrationHash: fingerprint(node.expression),
          declaration,
        });
        return;
      }
    }
    ts.forEachChild(node, (child) => visit(child, suites));
  }
  visit(source);
  return result;
}
const baselineFiles = git("ls-tree", "-r", "--name-only", options.base).split("\n").filter((file) => file.endsWith(".test.ts"));
const currentFiles = [...new Set(git("ls-files", "--cached", "--others", "--exclude-standard", "*.test.ts").split("\n"))]
  .filter((file) => file && fs.existsSync(resolve(file))).sort();
const baseline = baselineFiles.flatMap((file) => declarations(file, git("show", `${options.base}:${file}`)));
const current = currentFiles.flatMap((file) => declarations(file, fs.readFileSync(resolve(file), "utf8")));
const originalById = new Map(baseline.map((test) => [test.id, test]));
const inventory = read("test-audit/inventory.json");
const currentInventory = read("test-audit/current-inventory.json");
function checkInventory(snapshot, declarations_, kind, original) {
  const actual = new Map(declarations_.map((test) => [test.id, test]));
  const indexed = new Set();
  for (const file of snapshot.files) {
    const content = original ? git("show", `${options.base}:${file.path}`) : fs.existsSync(resolve(file.path)) ? fs.readFileSync(resolve(file.path), "utf8") : null;
    if (content === null || (file.sha256 && hash(content) !== file.sha256)) issue(kind, { file: file.path, reason: "file_hash_mismatch" });
    for (const test of file.tests) {
      const id = test.id || `${file.path}:${test.line}`;
      indexed.add(id);
      if (!actual.has(id)) issue(kind, { id, reason: "inventory_declaration_not_in_source" });
    }
  }
  for (const test of declarations_) if (!indexed.has(test.id)) issue(kind, { id: test.id, reason: "source_declaration_not_in_inventory" });
}
checkInventory(inventory, baseline, "baselineInventoryMismatch", true);
checkInventory(currentInventory, current, "currentInventoryMismatch", false);
const ledger = fs.existsSync(resolve("test-audit/ledger.json")) ? read("test-audit/ledger.json") : null;
function runtimeRows(report) {
  return report.testResults.flatMap((suite) => suite.assertionResults.map((test) => ({ file: relative(suite.name), name: test.fullName, status: test.status })));
}
const runtime = options.runtime ? runtimeRows(read(options.runtime)) : (ledger?.runtimeRows || []).map(({ file, name, status }) => ({ file: relative(file), name, status }));
const baselineRuntimePath = options["baseline-runtime"] || "test-audit/evidence/baseline.json";
const baselineRuntime = fs.existsSync(resolve(baselineRuntimePath)) ? runtimeRows(read(baselineRuntimePath)) : [];
if (!runtime.length) issue("missingRuntime", { evidence: options.runtime || "test-audit/ledger.json" });
if (!baselineRuntime.length) issue("missingBaselineRuntime", { evidence: baselineRuntimePath });
const baselineCases = new Set(baselineRuntime.map((test) => caseKey(test.file, test.name)));
const runtimeByKey = new Map();
for (const test of runtime) {
  const key = caseKey(test.file, test.name);
  if (runtimeByKey.has(key)) issue("duplicateRuntimeNames", test);
  runtimeByKey.set(key, test);
}
const actions = [];
const reviewDir = resolve("test-audit/reviews");
for (const file of fs.readdirSync(reviewDir).filter((file) => file.endsWith(".after.json")).sort()) {
  const document = JSON.parse(fs.readFileSync(path.join(reviewDir, file), "utf8"));
  for (const [group, rows] of [["original", document.tests || document.actions || []], ["additional", document.additionalTests || []]]) {
    rows.forEach((row, index) => actions.push({ ...row, ref: `${file}#${group}:${index}`, group }));
  }
}
const byOriginal = new Map();
for (const action of actions.filter((row) => row.beforeId)) {
  const rows = byOriginal.get(action.beforeId) || [];
  rows.push(action); byOriginal.set(action.beforeId, rows);
  if (!originalById.has(action.beforeId) && /\.test\.ts:\d+$/.test(action.beforeId)) issue("unknownOriginalActions", { ref: action.ref, beforeId: action.beforeId });
}
for (const test of baseline) {
  const rows = byOriginal.get(test.id) || [];
  if (rows.length !== 1) issue(rows.length ? "duplicateOriginalActions" : "missingOriginalActions", { id: test.id, actions: rows.map((row) => row.ref) });
  else if (!["kept", "rewritten", "deleted", "expected_failure", "blocked"].includes(rows[0].action)) issue("invalidOriginalAction", { id: test.id, action: rows[0].action || null });
  else if (rows[0].action === "blocked") issue("blockedActions", { id: test.id });
}
const actionsByCase = new Map();
for (const action of actions) {
  if (action.beforeId && !/\.test\.ts:\d+$/.test(action.beforeId)) continue; // separately audited shell/CI cases
  const targets = action.afterTests || (action.afterNames || (action.name ? [action.name] : [])).map((name) => ({ name, file: action.file }));
  for (const target of targets) {
    let candidates = runtime.filter((test) => test.name === target.name && (!target.file || test.file === relative(target.file)));
    const original = originalById.get(action.beforeId);
    if (!target.file && original && candidates.some((test) => test.file === original.file)) candidates = candidates.filter((test) => test.file === original.file);
    if (candidates.length !== 1) {
      issue(candidates.length ? "ambiguousActionTargets" : "missingActionRuntimeTargets", { ref: action.ref, target, candidates });
      continue;
    }
    const test = candidates[0];
    const key = caseKey(test.file, test.name);
    const rows = actionsByCase.get(key) || [];
    rows.push(action); actionsByCase.set(key, rows);
  }
}
const runtimeByDeclaration = new Map(current.map((test) => [test.id, []]));
const runtimeEvidence = runtime.map((test) => {
  let candidates = current.filter((declaration) => declaration.file === test.file && declaration.runtimePattern && new RegExp(declaration.runtimePattern).test(test.name));
  const literalMatches = candidates.filter((declaration) => !declaration.dynamicName);
  if (literalMatches.length) candidates = literalMatches;
  if (candidates.length !== 1) issue(candidates.length ? "ambiguousRuntimeDeclarations" : "unmappedRuntimeDeclarations", { ...test, declarations: candidates.map((row) => row.id) });
  const linked = (actionsByCase.get(caseKey(test.file, test.name)) || []).filter((action) => action.action !== "deleted" && action.action !== "blocked");
  const classifications = [...new Set(linked.map((action) => action.afterClassification || action.classification).filter((value) => classes.has(value)))];
  const classification = classifications.length === 1 ? classifications[0] : classifications.length ? "CONFLICT" : linked.length ? "UNCLASSIFIED" : "UNMAPPED";
  if (!classes.has(classification)) issue("runtimeClassificationGaps", { ...test, classification, actions: linked.map((action) => action.ref) });
  if (test.status !== "passed") issue("runtimeNotPassing", test);
  const isNew = baselineRuntime.length > 0 && !baselineCases.has(caseKey(test.file, test.name));
  if (isNew && !linked.some((action) => changedActions.has(action.action))) issue("newRuntimeCaseWithoutChangeAction", { ...test, actions: linked.map((action) => ({ ref: action.ref, action: action.action || null })) });
  const evidence = { ...test, classification, isNew, declarationId: candidates.length === 1 ? candidates[0].id : null, actions: linked.map((action) => ({ ref: action.ref, action: action.action || null, beforeId: action.beforeId || null, classification: action.afterClassification || action.classification || null })) };
  if (candidates.length === 1) runtimeByDeclaration.get(candidates[0].id).push(evidence);
  return evidence;
});
const currentDeclarations = current.map((test) => {
  const cases = runtimeByDeclaration.get(test.id);
  const sameName = baseline.filter((old) => old.file === test.file && old.sourceName === test.sourceName);
  const linkedOriginalIds = [...new Set(cases.flatMap((item) => item.actions.map((action) => action.beforeId).filter((id) => originalById.has(id))))];
  let originals = sameName.length === 1 ? sameName : linkedOriginalIds.map((id) => originalById.get(id));
  if (!originals.length) originals = baseline.filter((old) => old.file === test.file && old.bodyHash === test.bodyHash && old.bodyHash !== null);
  const unchanged = originals.some((old) => old.file === test.file && old.sourceName === test.sourceName && old.bodyHash === test.bodyHash && old.registrationHash === test.registrationHash);
  const change = unchanged ? "unchanged" : originals.length ? "changed_or_renamed" : "new";
  if (!cases.length) issue("declarationsWithoutRuntime", { id: test.id, name: test.sourceName, dynamicName: test.dynamicName });
  if (!unchanged) for (const item of cases) {
    const authorized = item.actions.some((action) => changedActions.has(action.action) && (action.action === "added" || !action.beforeId || originals.some((old) => old.id === action.beforeId)));
    if (!authorized) issue("changedBodyWithoutChangeAction", { id: test.id, name: item.name, change, originalIds: originals.map((old) => old.id), actions: item.actions });
  }
  for (const old of originals) {
    const identified = sameName.includes(old) || linkedOriginalIds.includes(old.id);
    const differs = old.file !== test.file || old.sourceName !== test.sourceName || old.bodyHash !== test.bodyHash || old.registrationHash !== test.registrationHash;
    if (identified && differs && (byOriginal.get(old.id) || []).some((action) => action.action === "kept")) {
      issue("keptDeclarationChanged", { beforeId: old.id, currentId: test.id, runtimeNames: cases.map((item) => item.name) });
    }
  }
  for (const old of sameName) {
    if ((byOriginal.get(old.id) || []).some((action) => action.action === "deleted") && old.bodyHash === test.bodyHash) issue("deletedDeclarationStillPresent", { beforeId: old.id, currentId: test.id });
  }
  const values = [...new Set(cases.map((item) => item.classification))];
  const classification = !values.length ? "UNMAPPED" : values.some((value) => !classes.has(value)) ? "INCOMPLETE" : values.length === 1 ? values[0] : "MIXED";
  if (classification === "MIXED") issue("mixedDeclarationClassifications", { id: test.id, classifications: values });
  return { ...test, change, originalIds: originals.map((old) => old.id), classification, runtimeCases: cases.map(({ name, classification, actions }) => ({ name, classification, actions })) };
});
const count = (rows, field) => rows.reduce((counts, row) => ({ ...counts, [row[field]]: (counts[row[field]] || 0) + 1 }), {});
const output = {
  schemaVersion: 1, base: options.base, cwd: root,
  evidence: { runtime: options.runtime || "test-audit/ledger.json#runtimeRows", baselineRuntime: baselineRuntimePath, actionFiles: [...new Set(actions.map((action) => action.ref.split("#")[0]))] },
  complete: Object.values(issues).every((rows) => rows.length === 0),
  allCurrentClassificationsStrong: currentDeclarations.length > 0 && currentDeclarations.every((test) => test.classification === "STRONG"),
  counts: { originalDeclarations: baseline.length, currentDeclarations: current.length, runtimeCases: runtime.length, originalActions: baseline.filter((test) => byOriginal.get(test.id)?.length === 1).length, declarationClassifications: count(currentDeclarations, "classification"), runtimeClassifications: count(runtimeEvidence, "classification"), changes: count(currentDeclarations, "change"), issues: Object.fromEntries(Object.entries(issues).map(([kind, rows]) => [kind, rows.length])) },
  issues, currentDeclarations, runtimeCases: runtimeEvidence,
  limitations: [
    "Classifications are explicit human action metadata joined to actual runtime cases, not inferred from matchers, passing status, mutation score, or source presence.",
    "Body and registration hashes compare TypeScript AST kinds, literal/identifier text and ordered children, ignoring comments and formatting. A structural change is conservatively treated as changed; semantic equivalence is not proven.",
    "Changes solely in imported helpers, fixtures, hook bodies, snapshots, or top-level data are not a transitive dependency analysis. New expanded runtime names still require explicit change actions.",
    "Template and printf/table titles use anchored patterns constrained to the same file and suite; exact literal declarations take precedence over dynamic patterns. Duplicate runtime names and multiple candidate declarations are gaps; arbitrary title expressions are not executed or guessed.",
    "The complete flag means metadata/source/runtime reconciliation has no gaps, not that every classification is STRONG; allCurrentClassificationsStrong and the actual counts are separate. Runtime evidence cannot prove freshness beyond current inventory/source hashes and exact names. Generate a current inventory and fresh full-suite report before accepting completion.",
    "This check verifies identity, action coverage and classification reconciliation. The separate mutation proof checker must validate killed assertions, surviving originals and restored application bytes.",
  ],
};
const serialized = `${JSON.stringify(output, null, 2)}\n`;
if (options.output) {
  fs.mkdirSync(path.dirname(resolve(options.output)), { recursive: true });
  fs.writeFileSync(resolve(options.output), serialized);
  process.stdout.write(`${baseline.length} originals; ${current.length} current declarations; ${runtime.length} runtime cases; ${Object.values(issues).reduce((sum, rows) => sum + rows.length, 0)} reconciliation gaps. Output: ${resolve(options.output)}\n`);
} else process.stdout.write(serialized);
if (options.strict && !output.complete) process.exitCode = 1;
