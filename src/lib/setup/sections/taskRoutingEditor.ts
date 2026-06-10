/**
 * Comma-list task routing editor (provider + model per selected task).
 */

import type { Interface as ReadlineInterface } from "readline/promises";
import {
  loadConfig,
  updateConfig,
  type GnosysConfig,
  type LLMProviderName,
} from "../../config.js";
import {
  ASSIGNABLE_TASK_LIST,
  fetchDynamicModels,
  getAssignableRouting,
  modelForTaskAssignment,
  parseCommaSeparatedTaskSelection,
  pickModel,
  pickProvider,
  TASK_DESCRIPTIONS,
  type AssignableTaskName,
} from "../../setup.js";
import { resolveActiveStorePath } from "../storePath.js";
import { safeQuestion } from "../ui/safePrompt.js";
import { renderProviderMark } from "../providerGlyphs.js";
import { c, color, glyph } from "../ui/tokens.js";
import { printStatus } from "../ui/status.js";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

async function askInput(
  rl: ReadlineInterface,
  prompt: string,
  opts?: { default?: string },
): Promise<string> {
  const hint = opts?.default ? ` ${DIM}(${opts.default})${RESET}` : "";
  const raw = await safeQuestion(rl, `${prompt}${hint} `);
  const trimmed = raw.trim();
  return trimmed || opts?.default || "";
}

async function askYesNo(
  rl: ReadlineInterface,
  question: string,
  defaultYes = true,
): Promise<boolean> {
  const hint = defaultYes ? "Y/n" : "y/N";
  const answer = await safeQuestion(rl, `${question} [${hint}] `);
  const trimmed = answer.trim().toLowerCase();
  if (trimmed === "") return defaultYes;
  return trimmed === "y" || trimmed === "yes";
}

/**
 * Let the user pick tasks by number, then provider + model for each.
 * Returns a patch for taskModels + dream, or null if cancelled.
 */
export async function runCommaListRoutingEditor(
  rl: ReadlineInterface,
  storePath: string,
  cfg: GnosysConfig,
): Promise<{
  taskModels: NonNullable<GnosysConfig["taskModels"]>;
  dream: GnosysConfig["dream"];
} | null> {
  const tasks = ASSIGNABLE_TASK_LIST;
  const dreamEnabledBefore = !!cfg.dream?.enabled;
  const currentByTask = {} as Record<
    AssignableTaskName,
    { provider: LLMProviderName; model: string }
  >;
  for (const task of tasks) {
    currentByTask[task] = getAssignableRouting(cfg, task);
  }

  console.log();
  console.log(
    `${BOLD}Which tasks should get a new provider and model?${RESET}`,
  );
  console.log(
    `${DIM}Enter numbers (comma-separated), ${BOLD}all${RESET}${DIM}, or ${BOLD}none${RESET}${DIM}. Unlisted tasks keep current routing.${RESET}`,
  );
  console.log();
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]!;
    const cur = currentByTask[task];
    const desc = TASK_DESCRIPTIONS[task] ?? "";
    const mark = renderProviderMark(cur.provider);
    const off =
      task === "dream" && !dreamEnabledBefore ? `  ${DIM}[off]${RESET}` : "";
    console.log(
      `  ${BOLD}${i + 1}.${RESET} ${mark} ${task.padEnd(14)} ${DIM}now:${RESET} ${cur.provider} / ${cur.model}  ${DIM}(${desc})${RESET}${off}`,
    );
  }
  console.log();

  let selectedIndices: number[] = [];
  while (true) {
    const raw = await askInput(rl, "Tasks to edit (e.g. 1,3,6 or all)", { default: "all" });
    const parsed = parseCommaSeparatedTaskSelection(raw, tasks.length);
    if (parsed === "all") {
      selectedIndices = tasks.map((_, i) => i);
      break;
    }
    if (parsed === "none") {
      selectedIndices = [];
      break;
    }
    if (parsed && parsed.length > 0) {
      selectedIndices = parsed;
      break;
    }
    console.log(`${color(c.fail, "Enter numbers 1-" + tasks.length + ", comma-separated, or 'all'.")}`);
  }

  if (selectedIndices.length === 0) {
    printStatus("warn", "no tasks selected");
    return null;
  }

  const selectedSet = new Set(selectedIndices.map((i) => tasks[i]!));
  const planned = { ...currentByTask };
  const dynamicModels = await fetchDynamicModels();

  for (const task of tasks) {
    if (!selectedSet.has(task)) continue;
    console.log("");
    console.log(`${BOLD}${task}${RESET} ${DIM}— ${TASK_DESCRIPTIONS[task] ?? ""}${RESET}`);
    const cur = currentByTask[task];
    const provider = await pickProvider(
      rl,
      dynamicModels,
      "Provider",
      cur.provider,
    );
    let model: string;
    const tiers = dynamicModels[provider];
    if (provider === "custom" || !tiers || tiers.length === 0) {
      model = await askInput(rl, "Model name", { default: cur.model });
    } else {
      model = await pickModel(rl, provider, dynamicModels, "Model", cur.model);
    }
    if (!model) {
      printStatus("warn", `skipped ${task} — no model`);
      continue;
    }
    planned[task] = {
      provider: provider as LLMProviderName,
      model: modelForTaskAssignment(task, provider, model),
    };
  }

  console.log();
  console.log(`${BOLD}Planned task routing${RESET}`);
  console.log(`  ${"Task".padEnd(16)}${"Provider / model".padEnd(42)}`);
  console.log(`  ${"\u2500".repeat(56)}`);
  for (const task of tasks) {
    const p = planned[task];
    const marker = selectedSet.has(task) ? `${color(c.accentHi, glyph.selection)} ` : "  ";
    const off =
      task === "dream" && !dreamEnabledBefore
        ? `  ${DIM}(dream off)${RESET}`
        : "";
    console.log(
      `${marker}${task.padEnd(14)}${p.provider} / ${p.model}${off}`,
    );
  }
  console.log(`${DIM}  ${glyph.selection} = will update${RESET}`);
  console.log();

  if (!(await askYesNo(rl, "Save this routing?", true))) {
    printStatus("warn", "cancelled");
    return null;
  }

  const taskModels: NonNullable<GnosysConfig["taskModels"]> = {
    ...(cfg.taskModels ?? {}),
  };
  for (const task of ASSIGNABLE_TASK_LIST) {
    if (task === "dream") continue;
    if (selectedSet.has(task)) {
      taskModels[task] = planned[task];
    }
  }

  let dream = { ...(cfg.dream ?? {}) };
  if (selectedSet.has("dream")) {
    dream = {
      ...dream,
      provider: planned.dream.provider,
      model: planned.dream.model,
    };
    if (!dreamEnabledBefore && (await askYesNo(rl, "Enable dream mode?", true))) {
      dream.enabled = true;
    }
  }

  return { taskModels, dream };
}

export async function applyRoutingPatch(
  projectDir: string,
  patch: {
    taskModels: NonNullable<GnosysConfig["taskModels"]>;
    dream: GnosysConfig["dream"];
  },
): Promise<GnosysConfig> {
  const storePath = resolveActiveStorePath(projectDir);
  await updateConfig(storePath, {
    taskModels: patch.taskModels,
    dream: patch.dream,
  } as Partial<GnosysConfig>);
  return loadConfig(storePath);
}
