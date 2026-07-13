/**
 * Setup: Task Routing.
 *
 * Standalone wizard for configuring per-task LLM routing
 * (structuring / synthesis / vision / transcription / dream).
 */

import type { Interface as ReadlineInterface } from "readline/promises";
import {
  loadConfig,
  updateConfig,
  getProviderModel,
  type GnosysConfig,
} from "../../config.js";
import {
  buildApiKeyRequirementsFromConfig,
  buildEffectiveRouting,
  ensureApiKeys,
} from "../../apiKeyVault.js";
import { safeQuestion } from "../ui/safePrompt.js";
import { Header } from "../ui/header.js";
import { Title } from "../ui/title.js";
import { Footer } from "../ui/footer.js";
import { printStatus } from "../ui/status.js";
import {
  classifyCost,
  renderRoutingTable,
  renderRoutingDiff,
  type TaskRow,
  type DiffEntry,
} from "../routingRender.js";
import { runCommaListRoutingEditor } from "./taskRoutingEditor.js";
import { resolveActiveStorePath } from "../storePath.js";

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

type TaskName = "structuring" | "synthesis" | "vision" | "transcription";
const TASKS: TaskName[] = ["structuring", "synthesis", "vision", "transcription"];

export interface RoutingOptions {
  rl: ReadlineInterface;
  directory: string;
}

async function ask(rl: ReadlineInterface, prompt: string): Promise<string> {
  return (await safeQuestion(rl, prompt)).trim();
}

async function askYesNo(rl: ReadlineInterface, prompt: string, defaultYes: boolean): Promise<boolean> {
  const hint = defaultYes ? " [Y/n] " : " [y/N] ";
  const answer = (await ask(rl, prompt + hint)).toLowerCase();
  if (!answer) return defaultYes;
  return answer === "y" || answer === "yes";
}

async function askChoice(
  rl: ReadlineInterface,
  prompt: string,
  choices: string[],
  defaultIdx = 0,
): Promise<number> {
  console.log("");
  if (prompt) console.log(prompt);
  choices.forEach((c, i) => {
    const marker = i === defaultIdx ? `  ${DIM}(default)${RESET}` : "";
    console.log(`  ${i + 1}. ${c}${marker}`);
  });
  for (let attempts = 0; attempts < 5; attempts++) {
    const answer = await ask(rl, "> ");
    if (!answer) return defaultIdx;
    const n = parseInt(answer, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= choices.length) return n - 1;
    console.log(`${DIM}Pick a number 1-${choices.length}${RESET}`);
  }
  return defaultIdx;
}

function buildTaskRows(
  routing: Record<string, { provider: string; model: string }>,
  baseline: Record<string, { provider: string; model: string }>,
  dreamEnabled: boolean,
): TaskRow[] {
  const rows: TaskRow[] = [];
  for (const t of [...TASKS, "dream" as const]) {
    const r = routing[t];
    const uses = `${r.provider} / ${r.model}`;
    const cost = t === "dream" && !dreamEnabled ? "free" : classifyCost(r.provider, r.model);
    const base = baseline[t];
    const changed = !base || base.provider !== r.provider || base.model !== r.model;
    rows.push({ task: t, uses, cost, changed });
  }
  return rows;
}

/**
 * Run the task-routing wizard.
 */
export async function runRoutingSetup(opts: RoutingOptions): Promise<boolean> {
  const storePath = resolveActiveStorePath(opts.directory);
  const cfg = await loadConfig(storePath);
  // v6.0.0 (deci-049): routing presupposes a default provider — direct the
  // user to the providers section instead of silently assuming anthropic.
  const provider = cfg.llm.defaultProvider;
  if (!provider) {
    console.log("");
    console.log("No default LLM provider configured. Run 'gnosys setup' (or 'gnosys setup providers') first.");
    return false;
  }
  const model = getProviderModel(cfg, provider);

  console.log("");
  console.log(Header(["gnosys", "setup", "routing"]));
  console.log("");
  console.log(
    Title("Task routing", "pick provider + model per task — set API keys under setup providers"),
  );
  console.log("");

  const dreamEnabled = !!cfg.dream?.enabled;
  const baseline = buildEffectiveRouting(cfg);
  const initialRows = buildTaskRows(baseline, baseline, dreamEnabled);
  console.log(renderRoutingTable(initialRows));
  console.log("");

  const choice = await askChoice(
    opts.rl,
    "What would you like to do?",
    [
      "Keep current routing (no changes)",
      "Edit tasks — set the same provider + model for all tasks (simple global default)",
      "Edit tasks — pick different providers/models for specific tasks (advanced)",
      "Reset all task overrides to the current default (the one shown in the main setup summary)",
    ],
    0,
  );

  if (choice === 0) {
    console.log(`${DIM}No changes.${RESET}`);
    return false;
  }

  if (choice === 1) {
    // Edit tasks — set the same provider + model for all tasks (simple global default)
    console.log("");
    printStatus("progress", "setting a single default for all tasks…");
    try {
      const { fetchDynamicModels } = await import("../../setup.js");
      const { pickModel } = await import("../../setup.js");
      const dynamicModels = await fetchDynamicModels();
      const currentModel = getProviderModel(cfg, provider);
      const chosenModel = await pickModel(
        opts.rl,
        provider,
        dynamicModels,
        `Default model for ${provider} (used for all tasks + dream)`,
        currentModel,
      );
      if (chosenModel && chosenModel !== currentModel) {
        const after = await loadConfig(storePath);
        await updateConfig(storePath, {
          llm: {
            ...after.llm,
            [provider]: {
              ...(after.llm[provider] || {}),
              model: chosenModel,
            },
          },
          // Clear per-task overrides so everything truly uses the single default
          taskModels: {},
        });
        printStatus("ok", `default set for everything · ${provider} / ${chosenModel}`);
      } else {
        printStatus("ok", "no change to the global default");
      }
    } catch (err) {
      printStatus("warn", "could not update default model", String(err));
    }
    return true;
  }

  if (choice === 3) {
    const { Diff } = await import("../ui/diff.js");
    const overridesBeingCleared = Object.entries(cfg.taskModels ?? {})
      .filter(([, v]) => v.provider !== provider || v.model !== model)
      .map(([task, v]) => ({
        label: task,
        from: `${v.provider} / ${v.model}`,
        to: `${provider} / ${model} (default)`,
      }));
    if (overridesBeingCleared.length > 0) {
      console.log("");
      console.log(Diff(overridesBeingCleared));
      console.log("");
    } else {
      console.log(`${DIM}No overrides to clear — already using default everywhere.${RESET}`);
    }
    console.log(`${DIM}The current default is ${provider} / ${model} (set via the main setup "Default provider" or the simple global option above).${RESET}`);
    const confirmReset = await askYesNo(opts.rl, "Reset all task overrides to the current default?", true);
    if (!confirmReset) {
      console.log(`${DIM}Cancelled.${RESET}`);
      return false;
    }
    await updateConfig(storePath, { taskModels: {} });
    printStatus("ok", "routing reset", "all tasks now use the global default provider/model");
    console.log(Footer("press enter to return"));
    return true;
  }

  // choice === 2 → advanced per-task editor (the powerful comma-list path)
  const patch = await runCommaListRoutingEditor(opts.rl, storePath, cfg);
  if (!patch) {
    return false;
  }

  await updateConfig(storePath, {
    taskModels: patch.taskModels,
    dream: patch.dream,
  } as Partial<GnosysConfig>);

  const updatedCfg = await loadConfig(storePath);
  const updatedRouting = buildEffectiveRouting(updatedCfg);
  const dreamEnabledNew = !!updatedCfg.dream?.enabled;
  const finalRows = buildTaskRows(updatedRouting, baseline, dreamEnabledNew);
  console.log("");
  console.log(renderRoutingTable(finalRows));
  console.log("");

  const diffEntries: DiffEntry[] = [];
  for (const t of [...TASKS, "dream" as const]) {
    const before = baseline[t];
    const after = updatedRouting[t];
    const fromStr = `${before.provider} / ${before.model}`;
    const toStr = `${after.provider} / ${after.model}`;
    diffEntries.push({ task: t, from: fromStr, to: toStr === fromStr ? null : toStr });
  }
  console.log(renderRoutingDiff(diffEntries));
  console.log("");
  printStatus("ok", "routing saved", `${storePath}/gnosys.json`);

  const keyReqs = buildApiKeyRequirementsFromConfig(updatedCfg);
  if (keyReqs.length > 0) {
    const askInput = async (r: ReadlineInterface, prompt: string) =>
      ask(r, `${prompt}: `);
    await ensureApiKeys(opts.rl, keyReqs, askInput, {
      dim: DIM,
      reset: RESET,
    });
  }

  console.log(Footer("press enter to return"));
  return true;
}
