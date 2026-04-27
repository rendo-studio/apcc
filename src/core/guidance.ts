import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

import { readText, writeText } from "./storage.js";
import { getWorkflowSkillPackageDir } from "./workflow-guide.js";

const APCC_AGENTS_BEGIN = "<!-- APCC:BEGIN -->";
const APCC_AGENTS_END = "<!-- APCC:END -->";

function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
}

function workflowSkillPath(root = process.cwd()): string {
  return path.join(root, ".agents", "skills", "apcc-workflow", "SKILL.md");
}

function workflowSkillDir(root = process.cwd()): string {
  return path.dirname(workflowSkillPath(root));
}

function agentsMdPath(root = process.cwd()): string {
  return path.join(root, "AGENTS.md");
}

export function getAgentsTemplateAssetPath(): string {
  return path.join(packageRoot(), "assets", "agents-template.md");
}

async function loadAgentsTemplate(): Promise<string> {
  return readText(getAgentsTemplateAssetPath());
}

function renderStandaloneAgentsMd(template: string): string {
  return `# AGENTS.md

${template.trim()}
`;
}

function renderWrappedAgentsSection(template: string): string {
  return `${APCC_AGENTS_BEGIN}\n${template.trim()}\n${APCC_AGENTS_END}`;
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function mergeAgentsMd(current: string, template: string): string {
  const standalone = renderStandaloneAgentsMd(template).trim();
  const wrapped = renderWrappedAgentsSection(template);
  const normalizedCurrent = normalizeLineEndings(current).trim();
  const normalizedStandalone = normalizeLineEndings(standalone).trim();
  const normalizedWrapped = normalizeLineEndings(wrapped).trim();
  if (normalizedCurrent === normalizedStandalone) {
    return `${standalone}\n`;
  }

  if (
    normalizedCurrent.startsWith("# AGENTS.md") &&
    normalizedCurrent.includes("## APCC") &&
    !normalizedCurrent.includes(APCC_AGENTS_BEGIN) &&
    !normalizedCurrent.includes(APCC_AGENTS_END)
  ) {
    return `${standalone}\n`;
  }

  if (normalizedCurrent === `${normalizedStandalone}\n\n${normalizedWrapped}`.trim()) {
    return `${standalone}\n`;
  }

  if (current.includes(APCC_AGENTS_BEGIN) && current.includes(APCC_AGENTS_END)) {
    const next = current.replace(
      new RegExp(`${APCC_AGENTS_BEGIN}[\\s\\S]*?${APCC_AGENTS_END}`, "m"),
      wrapped
    );
    if (next.trim() === `${standalone}\n\n${wrapped}`.trim()) {
      return `${standalone}\n`;
    }
    return next.endsWith("\n") ? next : `${next}\n`;
  }

  const trimmedCurrent = current.trimEnd();
  return `${trimmedCurrent}\n\n${wrapped}\n`;
}

export async function inspectGuidanceArtifacts(root = process.cwd()) {
  return {
    workflowSkillPath: workflowSkillPath(root),
    agentsMdPath: agentsMdPath(root),
    workflowSkillExists: existsSync(workflowSkillPath(root)),
    agentsMdExists: existsSync(agentsMdPath(root))
  };
}

export async function syncGuidanceArtifacts(root = process.cwd()) {
  const agentsTemplate = await loadAgentsTemplate();

  const sourceSkillDir = getWorkflowSkillPackageDir();
  const workflowPath = workflowSkillPath(root);
  const workflowDir = workflowSkillDir(root);
  const agentsPath = agentsMdPath(root);
  const agentsContent = existsSync(agentsPath)
    ? mergeAgentsMd(await readText(agentsPath), agentsTemplate)
    : renderStandaloneAgentsMd(agentsTemplate);

  await fs.rm(workflowDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(workflowDir), { recursive: true });
  await fs.cp(sourceSkillDir, workflowDir, { recursive: true });
  await writeText(agentsPath, agentsContent);

  return {
    workflowSkillPath: workflowPath,
    agentsMdPath: agentsPath
  };
}
