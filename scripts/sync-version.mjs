import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// This SEMVER regex and the one in src/lib/version.ts must stay identical.
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

const root = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new URL("../", import.meta.url));
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (typeof version !== "string" || SEMVER.exec(version)?.[0] !== version) {
  process.stderr.write(`gnosys: package.json version ${JSON.stringify(version)} is not valid semver\n`);
  process.exit(1);
}

const destination = join(root, "src", "version.ts");
const source = `// generated - do not edit; run npm run sync-version\nexport const GNOSYS_VERSION = ${JSON.stringify(version)};\n`;
if (!existsSync(destination) || readFileSync(destination, "utf8") !== source) {
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, source, "utf8");
}
