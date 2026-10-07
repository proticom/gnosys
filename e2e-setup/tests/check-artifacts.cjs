const assert = require("node:assert/strict");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

if (process.argv[2] === "init") {
  const directory = "/home/tester/proj-init";
  const identity = read(`${directory}/.gnosys/gnosys.json`);
  assert.equal(identity.schemaVersion, 1);
  assert.equal(identity.projectName, "proj-init");
  assert.equal(identity.workingDirectory, directory);
  assert.match(identity.projectId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  execFileSync("gnosys", ["init"], { cwd: directory, stdio: "pipe" });
  assert.equal(read(`${directory}/.gnosys/gnosys.json`).projectId, identity.projectId);
  const registry = JSON.parse(execFileSync("gnosys", ["projects", "--all", "--json"], { cwd: directory, encoding: "utf8" }));
  assert.deepEqual(registry.projects.map(({ id, name, working_directory }) => ({ id, name, working_directory })), [
    { id: identity.projectId, name: "proj-init", working_directory: directory },
  ]);
} else if (process.argv[2] === "web") {
  const directory = "/home/tester/proj-web";
  assert.equal(fs.statSync(`${directory}/knowledge`).isDirectory(), true);
  const web = read(`${directory}/.gnosys/gnosys.json`).web;
  assert.deepEqual(web, {
    source: "sitemap", sitemapUrl: "https://example.com/sitemap.xml", outputDir: "./knowledge",
    exclude: ["/api", "/admin", "/_next"],
    categories: { "/blog/*": "blog", "/services/*": "services", "/products/*": "products", "/about*": "company" },
    llmEnrich: false, prune: false,
  });
} else {
  throw new Error("Expected init or web artifact check");
}
