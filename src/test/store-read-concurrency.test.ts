import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { glob } from "glob";
import { GnosysStore } from "../lib/store.js";

vi.mock("glob", () => ({ glob: vi.fn() }));

const files = ["a.md", "b.md", "c.md", "d.md", "e.md", "f.md", "g.md", "h.md", "i.md", "j.md"];
let storePath: string;
let store: GnosysStore;

beforeEach(async () => {
  storePath = await fs.mkdtemp(path.join(os.tmpdir(), "gnosys-concurrent-reads-"));
  store = new GnosysStore(storePath);
  vi.mocked(glob).mockResolvedValue([...files]);
  for (const file of files) {
    await fs.writeFile(path.join(storePath, file), `---\nid: ${file}\ntitle: ${file}\n---\nContent ${file}`);
  }
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(storePath, { recursive: true, force: true });
});

describe("store memory reads", () => {
  it("caps reads at eight and keeps file order despite out-of-order completion", async () => {
    let releaseFirst = () => {};
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const readMemory = store.readMemory.bind(store);
    let active = 0;
    let peak = 0;
    const completed: string[] = [];
    vi.spyOn(store, "readMemory").mockImplementation(async (file) => {
      active++;
      peak = Math.max(peak, active);
      try {
        if (file === "a.md") await firstGate;
        const memory = await readMemory(file);
        completed.push(file);
        return memory;
      } finally {
        active--;
      }
    });

    const pending = store.getAllMemories();
    try {
      await vi.waitFor(() => expect(completed).toContain("h.md"));
    } finally {
      releaseFirst();
      await pending;
    }
    const memories = await pending;

    expect(peak).toBe(8);
    expect(active).toBe(0);
    expect(completed.indexOf("b.md")).toBeLessThan(completed.indexOf("a.md"));
    expect(memories.map((m) => [m.frontmatter.id, m.content])).toEqual([
      ["a.md", "Content a.md"], ["b.md", "Content b.md"],
      ["c.md", "Content c.md"], ["d.md", "Content d.md"],
      ["e.md", "Content e.md"], ["f.md", "Content f.md"],
      ["g.md", "Content g.md"], ["h.md", "Content h.md"],
      ["i.md", "Content i.md"], ["j.md", "Content j.md"],
    ]);
  });

  it("skips unreadable, malformed, invalid, and rejected files while retaining later results", async () => {
    await fs.rm(path.join(storePath, "b.md"));
    await fs.writeFile(path.join(storePath, "c.md"), "---\nid: [\n---\nMalformed");
    await fs.writeFile(path.join(storePath, "d.md"), "---\ntitle: No ID\n---\nInvalid");
    const readMemory = store.readMemory.bind(store);
    vi.spyOn(store, "readMemory").mockImplementation((file) => {
      if (file === "e.md") throw new Error("unexpected read failure");
      if (file === "f.md") return Promise.reject(new Error("rejected read"));
      return readMemory(file);
    });

    const memories = await store.getAllMemories();

    expect(memories.map((m) => [m.frontmatter.id, m.content])).toEqual([
      ["a.md", "Content a.md"], ["g.md", "Content g.md"],
      ["h.md", "Content h.md"],
      ["i.md", "Content i.md"], ["j.md", "Content j.md"],
    ]);
  });
});
