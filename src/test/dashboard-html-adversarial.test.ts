import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GnosysDB } from "../lib/db.js";
import { generatePortfolio } from "../lib/portfolio.js";
import { generatePortfolioHtml } from "../lib/portfolioHtml.js";
import { makeMemory, makeProject } from "./_helpers.js";

let directory: string;
let db: GnosysDB;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "gnosys-dashboard-adversarial-"));
  vi.stubEnv("GNOSYS_HOME", path.join(directory, "home"));
  db = new GnosysDB(directory);
});
afterEach(() => {
  db.close();
  vi.unstubAllEnvs();
  fs.rmSync(directory, { recursive: true, force: true });
});

function render(projectName: string, category: string, title: string) {
  db.insertProject(makeProject({ id: "dashboard-project", name: projectName, working_directory: "/dashboard-audit/project" }));
  db.insertMemory(makeMemory({ id: "dashboard-memory", project_id: "dashboard-project", category, title, content: "Stored dashboard content." }));
  const report = generatePortfolio(db);
  expect(report.totalProjects).toBe(1);
  expect(report.totalMemories).toBe(1);
  const html = generatePortfolioHtml(report, path.join(directory, "dashboard.html"));
  if (process.env.GNOSYS_DASHBOARD_ARTIFACT) fs.writeFileSync(process.env.GNOSYS_DASHBOARD_ARTIFACT, html);
  return html;
}

const payload = '</span><script>globalThis.dashboardInjected=true</script><img src=x onerror="globalThis.dashboardInjected=true"> & "quoted"';
const escaped = '&lt;/span&gt;&lt;script&gt;globalThis.dashboardInjected=true&lt;/script&gt;&lt;img src=x onerror=&quot;globalThis.dashboardInjected=true&quot;&gt; &amp; &quot;quoted&quot;';

describe("dashboard HTML adversarial stored content", () => {
  it("renders malicious roadmap memory titles as literal escaped text", () => {
    const html = render("Dashboard project", "roadmap", payload);
    expect(html).toContain(`<strong>${escaped}</strong> <span class="mem-id">dashboard-memory</span>`);
    expect(html).toContain(`<span class="act-title">${escaped}</span>`);
    expect(html.includes(payload)).toBe(false);
  });

  it("renders malicious open-question titles as escaped action text", () => {
    const html = render("Dashboard project", "open-questions", payload);
    expect(html).toContain(`<div class="action-text">${escaped}</div>`);
    expect(html).toContain(`<span class="act-title">${escaped}</span>`);
    expect(html.includes(payload)).toBe(false);
  });

  it.fails("D-DASH-001: clicking a project with an apostrophe cannot execute stored JavaScript", () => {
    const projectName = "QA');globalThis.dashboardInjected=true;//";
    const html = render(projectName, "roadmap", "Ordinary roadmap memory");
    const card = html.match(/<div class="readiness-card[^>]*>/)?.[0];
    if (!card) throw new Error("Generated dashboard has no readiness card");
    const encodedHandler = /onclick="([^"]*)"/.exec(card)?.[1];
    if (!encodedHandler) throw new Error("Generated readiness card has no click handler");
    const handler = encodedHandler.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    const selected: string[] = [];
    const browser = { dashboardInjected: false, scrollToProject: (name: string) => selected.push(name) };
    vm.runInNewContext(handler, browser, { timeout: 1000 });
    expect(browser.dashboardInjected).toBe(false);
    expect(selected).toEqual([projectName]);
  });
});
