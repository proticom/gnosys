const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const baseline = "/home/tester/tests/isolation-baseline.json";
const allowed = [".gnosys", ".config/gnosys", ".npm", ".cache", "tests", "proj-init", "proj-ni", "proj-wizard", "proj-web"]
  .map((directory) => `/home/tester/${directory}`);
const isAllowed = (file) => allowed.some((directory) => file === directory || file.startsWith(`${directory}/`));

function snapshot() {
  const entries = {};
  function visit(file) {
    if (isAllowed(file)) return;
    const stat = fs.lstatSync(file);
    if (stat.isDirectory()) {
      if (file !== "/home/tester/.config") entries[file] = "directory";
      let children;
      try { children = fs.readdirSync(file); } catch (error) {
        if (error.code === "EACCES") return;
        throw error;
      }
      for (const child of children.sort()) visit(path.join(file, child));
    } else if (stat.isFile()) {
      try { entries[file] = createHash("sha256").update(fs.readFileSync(file)).digest("hex"); } catch (error) {
        if (error.code !== "EACCES") throw error;
      }
    } else if (stat.isSymbolicLink()) {
      entries[file] = `symlink:${fs.readlinkSync(file)}`;
    }
  }
  for (const directory of ["/home/tester", "/tmp", "/var/tmp", "/dev/shm"]) visit(directory);
  return entries;
}

const current = snapshot();
if (process.argv[2] === "snapshot") {
  fs.writeFileSync(baseline, JSON.stringify(current));
} else if (process.argv[2] === "check") {
  const before = JSON.parse(fs.readFileSync(baseline, "utf8"));
  const changed = [...new Set([...Object.keys(before), ...Object.keys(current)])]
    .filter((file) => before[file] !== current[file]);
  assert.deepEqual(changed, [], "Unexpected changes outside approved setup directories");
  process.stdout.write("No unexpected changes in HOME, /tmp, /var/tmp, or /dev/shm\n");
} else {
  throw new Error("Expected snapshot or check");
}
