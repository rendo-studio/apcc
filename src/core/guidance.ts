import fs from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";

import { getApccPackageFile } from "./package-runtime.js";
import { readText, writeText } from "./storage.js";
import { getWorkflowSkillPackageDir } from "./workflow-guide.js";

const APCC_AGENTS_BEGIN = "<!-- APCC:BEGIN -->";
const APCC_AGENTS_END = "<!-- APCC:END -->";

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
  return getApccPackageFile("assets", "agents-template.md");
}

function getMaintainerGuidanceRoot(root = process.cwd()): string {
  return path.join(root, ".maintainer-guidance");
}

function getMaintainerAgentsTemplatePath(root = process.cwd()): string {
  return path.join(getMaintainerGuidanceRoot(root), "agents-template.md");
}

function getMaintainerWorkflowSkillPath(root = process.cwd()): string {
  return path.join(getMaintainerGuidanceRoot(root), "skills", "apcc-workflow", "SKILL.md");
}

function resolveAgentsTemplatePath(root = process.cwd()): string {
  const overridePath = getMaintainerAgentsTemplatePath(root);
  return existsSync(overridePath) ? overridePath : getAgentsTemplateAssetPath();
}

function resolveWorkflowSkillSourceDir(root = process.cwd()): string {
  const overridePath = getMaintainerWorkflowSkillPath(root);
  return existsSync(overridePath) ? path.dirname(overridePath) : getWorkflowSkillPackageDir();
}

async function loadAgentsTemplate(root = process.cwd()): Promise<string> {
  return readText(resolveAgentsTemplatePath(root));
}

function renderWrappedAgentsSection(template: string): string {
  return `${APCC_AGENTS_BEGIN}\n${template.trim()}\n${APCC_AGENTS_END}`;
}

function renderManagedAgentsMd(template: string): string {
  return `# AGENTS.md

${renderWrappedAgentsSection(template)}
`;
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function mergeAgentsMd(current: string, template: string): string {
  const managed = renderManagedAgentsMd(template).trim();
  const wrapped = renderWrappedAgentsSection(template);
  const legacyStandalone = `# AGENTS.md

${template.trim()}
`.trim();
  const normalizedCurrent = normalizeLineEndings(current).trim();
  const normalizedManaged = normalizeLineEndings(managed).trim();
  const normalizedLegacyStandalone = normalizeLineEndings(legacyStandalone).trim();
  const normalizedWrapped = normalizeLineEndings(wrapped).trim();
  if (
    normalizedCurrent === normalizedManaged ||
    normalizedCurrent === normalizedLegacyStandalone ||
    normalizedCurrent === normalizedWrapped
  ) {
    return `${managed}\n`;
  }

  if (current.includes(APCC_AGENTS_BEGIN) && current.includes(APCC_AGENTS_END)) {
    const next = current.replace(
      new RegExp(`${APCC_AGENTS_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${APCC_AGENTS_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m"),
      wrapped
    );
    return next.endsWith("\n") ? next : `${next}\n`;
  }

  const trimmedCurrent = current.trimEnd();
  if (trimmedCurrent.length === 0) {
    return `${managed}\n`;
  }
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
  const agentsTemplate = await loadAgentsTemplate(root);

  const sourceSkillDir = resolveWorkflowSkillSourceDir(root);
  const workflowPath = workflowSkillPath(root);
  const workflowDir = workflowSkillDir(root);
  const agentsPath = agentsMdPath(root);
  const agentsContent = existsSync(agentsPath)
    ? mergeAgentsMd(await readText(agentsPath), agentsTemplate)
    : renderManagedAgentsMd(agentsTemplate);

  await fs.rm(workflowDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(workflowDir), { recursive: true });
  await fs.cp(sourceSkillDir, workflowDir, { recursive: true });
  await writeText(agentsPath, agentsContent);

  return {
    workflowSkillPath: workflowPath,
    agentsMdPath: agentsPath
  };
}
