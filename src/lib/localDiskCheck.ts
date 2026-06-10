/**
 * Best-effort local-disk detection for master folder setup (v13).
 */

import { execSync } from "child_process";
import path from "path";

export const LOCAL_DISK_ACK_PHRASE = "LOCAL DISK ONLY";

export type LocalDiskCheckResult =
  | { verdict: "local"; message: string }
  | { verdict: "network"; message: string }
  | { verdict: "unknown"; message: string };

/** macOS: use `df` filesystem type; Linux: statfs not wired — treat as unknown. */
export function checkMasterPathLocalDisk(folderPath: string): LocalDiskCheckResult {
  const resolved = path.resolve(folderPath);
  if (process.platform === "darwin") {
    try {
      const out = execSync(`df -T "${resolved}"`, { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
      const line = out.trim().split("\n")[1] ?? "";
      const fsType = line.split(/\s+/)[1]?.toLowerCase() ?? "";
      const networkTypes = new Set([
        "smbfs",
        "nfs",
        "afpfs",
        "webdav",
        "fuse",
        "osxfuse",
        "mntfs",
      ]);
      if (networkTypes.has(fsType)) {
        return {
          verdict: "network",
          message: `Path appears to be on a network filesystem (${fsType}). Master DB must be on local disk.`,
        };
      }
      if (fsType === "apfs" || fsType === "hfs" || fsType === "devfs") {
        return { verdict: "local", message: `Path is on local disk (${fsType}).` };
      }
    } catch {
      // fall through to unknown
    }
  }
  const lower = resolved.toLowerCase();
  if (
    lower.includes("/volumes/") &&
    !lower.includes("/volumes/macintosh hd") &&
    !lower.startsWith("/users/")
  ) {
    return {
      verdict: "unknown",
      message:
        "Path is under /Volumes/ — could be an external or network volume. Cloud-sync folders (Dropbox, iCloud) also look local but corrupt SQLite.",
    };
  }
  return {
    verdict: "unknown",
    message: "Could not verify this path is a plain local disk (not NAS, cloud-sync, or VPN mount).",
  };
}

export function matchesLocalDiskAck(input: string): boolean {
  return input.trim() === LOCAL_DISK_ACK_PHRASE;
}
