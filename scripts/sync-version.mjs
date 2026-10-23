import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new URL("../", import.meta.url));
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (typeof version !== "string") {
  throw new Error("gnosys: package.json version must be a string");
}

const destination = join(root, "src", "version.ts");
const source = `// generated - do not edit; run npm run sync-version\nexport const GNOSYS_VERSION = ${JSON.stringify(version)};\n`;
if (!existsSync(destination) || readFileSync(destination, "utf8") !== source) {
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, source, "utf8");
}
