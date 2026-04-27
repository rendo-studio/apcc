import { AclipApp, booleanArgument, stringArgument } from "@rendo-studio/aclip";

import { initWorkspace } from "../../core/bootstrap.js";
import { normalizeDocsLanguage } from "../../core/workspace-config.js";
import { withGuideHint } from "../guide-hint.js";

function assertProjectKind(value?: string): "general" | "frontend" | "library" | "service" | undefined {
  if (!value) {
    return undefined;
  }

  if (!["general", "frontend", "library", "service"].includes(value)) {
    throw new Error(`Unsupported projectKind "${value}".`);
  }

  return value as "general" | "frontend" | "library" | "service";
}

function assertDocsMode(value?: string): "minimal" | "standard" | undefined {
  if (!value) {
    return undefined;
  }

  if (!["minimal", "standard"].includes(value)) {
    throw new Error(`Unsupported docsMode "${value}".`);
  }

  return value as "minimal" | "standard";
}

function assertDocsLanguage(value?: string): "en" | "zh-CN" | undefined {
  if (!value) {
    return undefined;
  }

  if (!["en", "en-US", "zh", "zh-CN"].includes(value)) {
    throw new Error(`Unsupported docsLanguage "${value}". Use en or zh-CN.`);
  }

  const normalized = normalizeDocsLanguage(value);
  return normalized;
}

export function registerInitCommand(app: AclipApp) {
  app.command("init", {
    summary: "Initialize a new APCC workspace.",
    description: withGuideHint(
      "Initialize APCC in the current directory or target path. Empty directories get a new workspace; existing projects are attached safely without rewriting existing authored docs."
    ),
    arguments: [
      stringArgument("targetPath", {
        required: false,
        description: "Target directory to initialize. Defaults to the current directory.",
        flag: "--target-path"
      }),
      stringArgument("projectName", {
        required: false,
        description: "Optional human-readable project name. Defaults to the current directory name.",
        flag: "--project-name"
      }),
      stringArgument("projectSummary", {
        required: false,
        description: "Optional project overview summary. If omitted, APCC writes a provisional overview anchor.",
        flag: "--project-summary"
      }),
      stringArgument("endGoalName", {
        required: false,
        description: "Optional long-lived end goal name. If omitted, APCC writes a provisional end goal anchor.",
        flag: "--end-goal-name"
      }),
      stringArgument("endGoalSummary", {
        required: false,
        description: "Optional one-sentence end goal summary. If omitted, APCC writes a provisional end goal anchor.",
        flag: "--end-goal-summary"
      }),
      stringArgument("projectKind", {
        required: false,
        description: "Optional project kind: general, frontend, library, or service.",
        flag: "--project-kind"
      }),
      stringArgument("docsMode", {
        required: false,
        description: "Optional docs mode: minimal or standard.",
        flag: "--docs-mode"
      }),
      stringArgument("docsLanguage", {
        required: false,
        description: "Optional primary docs language: en or zh-CN. Defaults to en for new workspaces and to the persisted docs language for existing APCC workspaces.",
        flag: "--docs-language"
      }),
      booleanArgument("force", {
        required: false,
        description: "Allow overwriting APCC-managed control-plane files.",
        flag: "--force"
      })
    ],
    examples: [
      "apcc init",
      "apcc init --project-name Example --project-summary 'agent-first project context framework for a service repo.' --end-goal-name 'Make Example reliable' --end-goal-summary 'Turn Example into a stable product with a clear delivery loop.'",
      "apcc init --project-name 示例项目 --docs-language zh-CN --project-summary '面向开发代理的项目上下文框架。' --end-goal-name '完成首个稳定版本' --end-goal-summary '将示例项目推进到可持续迭代的稳定状态。'",
      "apcc init --target-path D:/project/existing --project-name Existing --project-summary 'Existing repo brought under APCC management.'",
      "apcc init --target-path D:/project/example --project-name Example --project-summary 'Frontend app managed through APCC.' --project-kind frontend --docs-mode standard"
    ],
    handler: async (payload) => ({
      init: await initWorkspace({
        targetPath: payload.targetPath ? String(payload.targetPath) : undefined,
        projectName: payload.projectName ? String(payload.projectName) : undefined,
        projectSummary: payload.projectSummary ? String(payload.projectSummary) : undefined,
        endGoalName: payload.endGoalName ? String(payload.endGoalName) : undefined,
        endGoalSummary: payload.endGoalSummary ? String(payload.endGoalSummary) : undefined,
        projectKind: assertProjectKind(payload.projectKind ? String(payload.projectKind) : undefined),
        docsMode: assertDocsMode(payload.docsMode ? String(payload.docsMode) : undefined),
        docsLanguage: assertDocsLanguage(payload.docsLanguage ? String(payload.docsLanguage) : undefined),
        force: Boolean(payload.force)
      })
    })
  });
}
