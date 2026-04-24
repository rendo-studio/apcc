export type TaskStatus = "pending" | "in_progress" | "done" | "blocked";
export type DecisionCategory = "goal" | "scope" | "change" | "architecture" | "version" | "policy" | "other";
export type DecisionStatus = "pending" | "approved" | "rejected";
export type VersionRecordStatus = "draft" | "recorded";
export type PageBoundaryMode = "editable" | "projection" | "hybrid";
export type DocsLanguage = "en" | "zh-CN";

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
}

export interface PlansState {
  endGoalRef: string;
  items: PlanNode[];
}

export interface DerivedPlanNode extends PlanNode {
  status: TaskStatus;
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

export interface WorkspaceState {
  activeChange: string | null;
  currentRoundId: string | null;
}

export interface WorkspaceMetaState {
  schemaVersion: number;
  workspaceName: string;
  docsRoot: string;
  workspaceRoot: string;
  bootstrapMode: "init";
  templateVersion: string;
  projectKind: "general" | "frontend" | "library" | "service";
  docsMode: "minimal" | "standard";
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
  siteFramework: string;
  packageManager: string;
  projectKind: "general" | "frontend" | "library" | "service";
  docsMode: "minimal" | "standard";
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
