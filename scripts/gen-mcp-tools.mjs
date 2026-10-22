#!/usr/bin/env node
/**
 * Generate docs/mcp-tools.md from MCP tool registrations in src/index.ts.
 * Read-only; no extra dependencies.
 */

import fs from "fs";
import path from "path";

const REPO_ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const INDEX = path.join(REPO_ROOT, "src", "index.ts");
const OUT = path.join(REPO_ROOT, "docs", "mcp-tools.md");

/** regTool("gnosys_*", "description", { schema }) — first arg only, not audit refs.
 *  v6.2: also matches s.tool(...) for gnosys_toolset (registered per-server). */
const REG_TOOL_RE =
  /(?:regTool|s\.tool)\(\s*\n\s*"(gnosys_[^"]+)"\s*,\s*\n\s*"((?:[^"\\]|\\.)*)"/g;

function collapseWhitespace(s) {
  return s.replace(/\s+/g, " ").trim();
}

function extractTools(source) {
  const tools = [];
  let match;
  while ((match = REG_TOOL_RE.exec(source)) !== null) {
    tools.push({ name: match[1], description: collapseWhitespace(JSON.parse(`"${match[2]}"`)) });
  }
  return tools;
}

function renderMarkdown(tools, source) {
  const tiers = Object.fromEntries(["CORE_TOOLS", "STANDARD_EXTRA_TOOLS"].map(key => {
    const block = source.match(new RegExp(`const ${key} = new Set\\([\\s\\S]*?\\]`))?.[0] ?? "";
    return [key, new Set([...block.matchAll(/"([a-z_]+)"/g)].map(m => `gnosys_${m[1]}`))];
  }));
  const annotationSource = fs.readFileSync(path.join(REPO_ROOT, "src/lib/toolAnnotations.ts"), "utf8");
  const annotations = new Map([...annotationSource.matchAll(/(gnosys_\w+): \{([^}]+)\}/g)].map(m => {
    const hints = Object.fromEntries([...m[2].matchAll(/(\w+Hint): (true|false)/g)].map(h => [h[1], h[2]]));
    return [m[1], hints];
  }));
  const rows = tools
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => {
      const tier = tiers.CORE_TOOLS.has(t.name) ? "core" : tiers.STANDARD_EXTRA_TOOLS.has(t.name) ? "standard" : "full";
      const hints = annotations.get(t.name);
      if (!hints || Object.keys(hints).length !== 4) throw new Error(`Missing annotations: ${t.name}`);
      return `| \`${t.name}\` | ${tier} | ${hints.readOnlyHint} | ${hints.destructiveHint} | ${hints.idempotentHint} | ${hints.openWorldHint} | ${t.description.replace(/\|/g, "\\|")} |`;
    })
    .join("\n");

  return `# MCP Tools

_Generated from \`src/index.ts\` by \`scripts/gen-mcp-tools.mjs\`. Do not edit by hand._

Hints apply to all supported arguments and configurations. See [annotation decisions](mcp-toolsets.md#annotation-decisions) for user-visible effects and optional external operations.

| Tool | Tier | readOnlyHint | destructiveHint | idempotentHint | openWorldHint | Description |
|------|------|--------------|-----------------|----------------|---------------|-------------|
${rows}
`;
}

function main() {
  const source = fs.readFileSync(INDEX, "utf8");
  const tools = extractTools(source);
  if (tools.length === 0) {
    console.error("No MCP tools found in src/index.ts");
    process.exit(1);
  }

  const markdown = renderMarkdown(tools, source);
  const write = process.argv.includes("--write");

  if (write) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, markdown);
  } else {
    process.stdout.write(markdown);
  }
}

main();
