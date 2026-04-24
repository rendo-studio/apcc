import type { DocsLanguage, WorkspaceConfigState, WorkspaceDocsSiteConfig } from "./types.js";
import { readYamlFile } from "./storage.js";
import { getWorkspacePaths } from "./workspace.js";

type ProjectKind = "general" | "frontend" | "library" | "service";
type DocsMode = "minimal" | "standard";
type LegacyDocsLanguage = DocsLanguage | "zh" | "en-US";

interface LegacyWorkspaceConfigState {
  docsSiteEnabled?: boolean;
  siteFramework?: string;
  packageManager?: string;
  projectKind?: ProjectKind;
  docsMode?: DocsMode;
  docsLanguage?: LegacyDocsLanguage;
  primaryDocsLanguage?: LegacyDocsLanguage;
  docsSite?: Partial<WorkspaceDocsSiteConfig> | null;
  workspaceSchemaVersion?: number;
}

interface WorkspaceMetaLike {
  projectKind?: ProjectKind;
  docsMode?: DocsMode;
  docsLanguage?: DocsLanguage;
  schemaVersion?: number;
}

export function defaultDocsSiteConfig(): WorkspaceDocsSiteConfig {
  return {
    enabled: true,
    sourcePath: "docs",
    preferredPort: null
  };
}

export function normalizeDocsLanguage(value?: string | null): DocsLanguage {
  if (value === "zh" || value === "zh-CN") {
    return "zh-CN";
  }

  if (value === "en" || value === "en-US") {
    return "en";
  }

  return "en";
}

export function normalizeWorkspaceConfig(
  raw: LegacyWorkspaceConfigState | null | undefined,
  fallback: {
    projectKind?: ProjectKind;
    docsMode?: DocsMode;
    docsLanguage?: DocsLanguage;
    workspaceSchemaVersion?: number;
  } = {}
): WorkspaceConfigState {
  const docsSite = raw?.docsSite;

  return {
    siteFramework: raw?.siteFramework ?? "fumadocs",
    packageManager: raw?.packageManager ?? "npm",
    projectKind: raw?.projectKind ?? fallback.projectKind ?? "general",
    docsMode: raw?.docsMode ?? fallback.docsMode ?? "standard",
    docsLanguage: normalizeDocsLanguage(raw?.docsLanguage ?? raw?.primaryDocsLanguage ?? fallback.docsLanguage),
    docsSite: {
      enabled: docsSite?.enabled ?? raw?.docsSiteEnabled ?? true,
      sourcePath: docsSite?.sourcePath ?? "docs",
      preferredPort:
        typeof docsSite?.preferredPort === "number" && Number.isInteger(docsSite.preferredPort)
          ? docsSite.preferredPort
          : null
    },
    workspaceSchemaVersion: raw?.workspaceSchemaVersion ?? fallback.workspaceSchemaVersion ?? 0
  };
}

export async function loadWorkspaceConfig(start = process.cwd()): Promise<WorkspaceConfigState> {
  const paths = getWorkspacePaths(start);
  const meta = await readYamlFile<WorkspaceMetaLike>(paths.workspaceMetaFile).catch(() => null);
  const raw = await readYamlFile<LegacyWorkspaceConfigState>(paths.workspaceConfigFile).catch(() => null);
  return normalizeWorkspaceConfig(raw, {
    projectKind: meta?.projectKind,
    docsMode: meta?.docsMode,
    docsLanguage: meta?.docsLanguage,
    workspaceSchemaVersion: meta?.schemaVersion
  });
}
