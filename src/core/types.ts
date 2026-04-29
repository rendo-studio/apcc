export const TASK_STATUSES = ["pending", "in_progress", "done", "blocked"] as const;
export const DECISION_CATEGORIES = ["goal", "scope", "change", "architecture", "version", "policy", "other"] as const;
export const DECISION_STATUSES = ["pending", "approved", "rejected"] as const;
export const VERSION_RECORD_STATUSES = ["draft", "recorded"] as const;
export const PAGE_BOUNDARY_MODES = ["editable", "projection", "hybrid"] as const;
export const DOCS_LANGUAGES = ["en", "zh-CN"] as const;
export const PROJECT_KINDS = ["general", "frontend", "library", "service"] as const;
export const DOCS_MODES = ["minimal", "standard"] as const;
export const BOOTSTRAP_MODES = ["init"] as const;
export const SITE_FRAMEWORKS = ["fumadocs"] as const;
export const PACKAGE_MANAGERS = ["npm"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type DecisionCategory = (typeof DECISION_CATEGORIES)[number];
export type DecisionStatus = (typeof DECISION_STATUSES)[number];
export type VersionRecordStatus = (typeof VERSION_RECORD_STATUSES)[number];
export type PageBoundaryMode = (typeof PAGE_BOUNDARY_MODES)[number];
export type DocsLanguage = (typeof DOCS_LANGUAGES)[number];
export type ProjectKind = (typeof PROJECT_KINDS)[number];
export type DocsMode = (typeof DOCS_MODES)[number];
export type BootstrapMode = (typeof BOOTSTRAP_MODES)[number];
export type SiteFramework = (typeof SITE_FRAMEWORKS)[number];
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export interface GoalState {
  goalId: string;
  name: string;
  summary: string;
  docPath: string;
  successCriteria: string[];
  nonGoals: string[];
}

export interface ProjectOverviewState {
  name: string;
  summary: string;
  docPath: string;
}

export interface PlanNode {
  id: string;
  name: string;
  summary: string | null;
  parentPlanId: string | null;
  versionRef: string | null;
}

export interface PlansState {
  endGoalRef: string;
  items: PlanNode[];
}

export interface DerivedPlanNode extends PlanNode {
  status: TaskStatus;
  effectiveVersionRef: string | null;
}

export interface DerivedPlansState {
  endGoalRef: string;
  items: DerivedPlanNode[];
}

export interface TaskNode {
  id: string;
  name: string;
  summary: string | null;
  status: TaskStatus;
  planRef: string;
  parentTaskId: string | null;
  countedForProgress: boolean;
}

export interface TasksState {
  items: TaskNode[];
}

export interface TaskArchiveEntry {
  id: string;
  name: string;
  planRef: string;
  parentTaskId: string | null;
  status: TaskStatus;
  closedAt: string;
  closedByChange: string | null;
  summary: string | null;
}

export interface TaskArchiveState {
  items: TaskArchiveEntry[];
}

export interface ProgressState {
  percent: number;
  countedTasks: number;
  doneTasks: number;
  computedAt: string | null;
}

export interface DocRevisionEntry {
  id: string;
  createdAt: string;
  hash: string;
  title: string;
  description: string;
  content: string;
}

export interface DocRevisionRecord {
  path: string;
  slug: string[];
  title: string;
  description: string;
  latestRevisionId: string;
  updatedAt: string;
  revisions: DocRevisionEntry[];
}

export interface DocsRevisionState {
  generatedAt: string | null;
  items: DocRevisionRecord[];
}

export interface WorkspaceMetaState {
  workspaceSchemaVersion: number;
  apccVersion: string;
  workspaceName: string;
  docsRoot: string;
  workspaceRoot: string;
  bootstrapMode: BootstrapMode;
  templateVersion: string;
  projectKind: ProjectKind;
  docsMode: DocsMode;
  docsLanguage: DocsLanguage;
  createdAt: string;
  lastUpgradedAt: string | null;
}

export interface WorkspaceDocsSiteConfig {
  enabled: boolean;
  sourcePath: string | null;
  preferredPort: number | null;
}

export interface WorkspaceConfigState {
  siteFramework: SiteFramework;
  packageManager: PackageManager;
  projectKind: ProjectKind;
  docsMode: DocsMode;
  docsLanguage: DocsLanguage;
  docsSite: WorkspaceDocsSiteConfig;
  workspaceSchemaVersion: number;
}

export interface TaskTreeNode extends TaskNode {
  children: TaskTreeNode[];
}

export interface PlanTreeNode extends DerivedPlanNode {
  children: PlanTreeNode[];
}

export interface DecisionRecord {
  id: string;
  name: string;
  description: string;
  docPath: string | null;
  category: DecisionCategory;
  proposedBy: string;
  context: string;
  impactOfNoAction: string;
  expectedOutcome: string;
  boundary: string;
  status: DecisionStatus;
  decisionSummary: string | null;
  revisitCondition: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface DecisionState {
  items: DecisionRecord[];
}

export interface VersionRecord {
  id: string;
  version: string;
  title: string;
  summary: string;
  docPath: string | null;
  status: VersionRecordStatus;
  decisionRefs: string[];
  highlights: string[];
  breakingChanges: string[];
  migrationNotes: string[];
  validationSummary: string | null;
  createdAt: string;
  recordedAt: string | null;
}

export interface VersionState {
  items: VersionRecord[];
}

export interface PageBoundary {
  path: string;
  slug: string[];
  title: string;
  mode: PageBoundaryMode;
  managedSections: string[];
  reason: string;
}
