import type {
  BootstrapMode,
  DocsLanguage,
  DocsMode,
  ProjectKind,
  WorkspaceConfigState,
  WorkspaceDocsSiteConfig,
  WorkspaceMetaState
} from "./types.js";
import { readYamlFile } from "./storage.js";
import { getWorkspacePaths } from "./workspace.js";

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

interface LegacyWorkspaceMetaState {
  workspaceSchemaVersion?: number;
  projectKind?: ProjectKind;
  docsMode?: DocsMode;
  docsLanguage?: LegacyDocsLanguage;
  schemaVersion?: number;
  apccVersion?: string;
  workspaceName?: string;
  docsRoot?: string;
  workspaceRoot?: string;
  bootstrapMode?: BootstrapMode;
  templateVersion?: string;
  createdAt?: string;
  lastUpgradedAt?: string | null;
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
    siteFramework: raw?.siteFramework === "fumadocs" ? raw.siteFramework : "fumadocs",
    packageManager: raw?.packageManager === "npm" ? raw.packageManager : "npm",
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

export function normalizeWorkspaceMeta(
  raw: LegacyWorkspaceMetaState | null | undefined,
  fallback: {
    workspaceSchemaVersion?: number;
    apccVersion?: string;
  } = {}
): WorkspaceMetaState | null {
  if (!raw) {
    return null;
  }

  return {
    workspaceSchemaVersion: raw.workspaceSchemaVersion ?? raw.schemaVersion ?? fallback.workspaceSchemaVersion ?? 0,
    apccVersion:
      typeof raw.apccVersion === "string" && raw.apccVersion.trim().length > 0
        ? raw.apccVersion
        : fallback.apccVersion ?? "unknown",
    workspaceName: raw.workspaceName ?? "apcc-workspace",
    docsRoot: raw.docsRoot ?? "docs",
    workspaceRoot: raw.workspaceRoot ?? ".apcc",
    bootstrapMode: raw.bootstrapMode ?? "init",
    templateVersion: raw.templateVersion ?? "",
    projectKind: raw.projectKind ?? "general",
    docsMode: raw.docsMode ?? "standard",
    docsLanguage: normalizeDocsLanguage(raw.docsLanguage),
    createdAt: raw.createdAt ?? "",
    lastUpgradedAt: raw.lastUpgradedAt ?? null
  };
}

export async function loadWorkspaceMeta(start = process.cwd()): Promise<WorkspaceMetaState | null> {
  const paths = getWorkspacePaths(start);
  const raw = await readYamlFile<LegacyWorkspaceMetaState>(paths.workspaceMetaFile).catch(() => null);
  return normalizeWorkspaceMeta(raw);
}

export async function loadWorkspaceConfig(start = process.cwd()): Promise<WorkspaceConfigState> {
  const paths = getWorkspacePaths(start);
  const rawMeta = await readYamlFile<LegacyWorkspaceMetaState>(paths.workspaceMetaFile).catch(() => null);
  const meta = normalizeWorkspaceMeta(rawMeta);
  const raw = await readYamlFile<LegacyWorkspaceConfigState>(paths.workspaceConfigFile).catch(() => null);
  return normalizeWorkspaceConfig(raw, {
    projectKind: meta?.projectKind,
    docsMode: meta?.docsMode,
    docsLanguage: meta?.docsLanguage,
    workspaceSchemaVersion: meta?.workspaceSchemaVersion
  });
}
