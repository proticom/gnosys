import { GNOSYS_VERSION } from "../version.js";

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export function validateGnosysVersion(version: unknown): string {
  if (typeof version !== "string" || SEMVER.exec(version)?.[0] !== version) {
    throw new Error("gnosys: embedded version missing or invalid; rebuild the package");
  }
  return version;
}

export function getGnosysVersion(): string {
  return validateGnosysVersion(GNOSYS_VERSION);
}
