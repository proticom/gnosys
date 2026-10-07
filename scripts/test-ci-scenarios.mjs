import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const scenario = process.argv[2];
assert.ok(["multi-project", "local-storage"].includes(scenario), "Choose a CI scenario");
const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-ci-scenario-")));
const cli = path.resolve("dist/cli.js");
const home = path.join(base, "home");
fs.mkdirSync(home);
const env = {
  PATH: `${path.dirname(process.execPath)}:${process.env.PATH}`,
  HOME: home,
  USERPROFILE: home,
  GNOSYS_HOME: path.join(home, ".gnosys"),
  GNOSYS_CONFIG_DIR: path.join(home, ".config/gnosys"),
  CI: "true",
  NODE_ENV: "test",
};
const run = (directory, args) => execFileSync(process.execPath, [cli, ...args], {
  cwd: directory, env, encoding: "utf8", timeout: 20_000,
});
const json = (directory, args) => JSON.parse(run(directory, [...args, "--json"]));

try {
  const projects = scenario === "multi-project" ? [
    { name: "Alpha", title: "Alpha Architecture", category: "architecture", content: "Project Alpha uses microservices with gRPC.", query: "microservices" },
    { name: "Beta", title: "Beta Testing Strategy", category: "requirements", content: "Project Beta uses integration testing with TestContainers.", query: "TestContainers" },
    { name: "Gamma", title: "Gamma Deployment", category: "decisions", content: "Project Gamma deploys to Kubernetes with Helm charts.", query: "Kubernetes" },
  ] : [
    { name: "Local storage", title: "Shared Knowledge", category: "concepts", content: "This memory survives reopening the central database.", query: "reopening" },
  ];

  for (const project of projects) {
    const directory = path.join(base, project.name);
    fs.mkdirSync(directory);
    run(directory, ["init", "--name", project.name]);
    run(directory, ["add-structured", "--title", project.title, "--content", project.content, "--category", project.category]);
  }

  for (const project of projects) {
    const directory = path.join(base, project.name);
    const identity = JSON.parse(fs.readFileSync(path.join(directory, ".gnosys/gnosys.json"), "utf8"));
    assert.equal(identity.projectName, project.name);
    assert.equal(identity.workingDirectory, directory);
    assert.equal(json(directory, ["stats"]).totalCount, 1);
    const listed = json(directory, ["list", "--store", "project"]);
    assert.deepEqual(listed.memories.map((memory) => ({ title: memory.title, project: memory.project, scope: memory.scope })), [
      { title: project.title, project: project.name, scope: "project" },
    ]);
    const results = json(directory, ["search", project.query]).results;
    assert.deepEqual(results.map((memory) => ({ title: memory.title, projectId: memory.project_id })), [
      { title: project.title, projectId: identity.projectId },
    ]);
    assert.equal(results[0].id, listed.memories[0].id);
  }
  process.stdout.write(`${scenario}: project identities, scoped lists/stats, and persisted search results verified\n`);
} finally {
  fs.rmSync(base, { recursive: true, force: true });
}
