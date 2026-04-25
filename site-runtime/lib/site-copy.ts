import type { SiteLocale } from "./i18n";
import { docsPathToHref } from "./docs-path";

interface SiteCopy {
  locale: string;
  console: {
    projectLabel: string;
    projectFallback: string;
    missingProjectSummary: string;
    noEndGoal: string;
    missingEndGoalSummary: string;
    unknown: string;
    readProjectOverview: string;
    endGoal: string;
    progress: string;
    viewPlans: string;
    successCriteria: string;
    noSuccessCriteria: string;
    nonGoals: string;
    noNonGoals: string;
    unreadChangedDocs: string;
    noUnreadChangedDocs: string;
    recentChangedDocs: string;
    noRecentChangedDocs: string;
    changedAtLabel: string;
    planTree: string;
    noTaskData: string;
    noPlanData: string;
    noPlanTasks: string;
    progressUnit: string;
    groupingNode: string;
    childPlans: string;
    directTasks: string;
    plans: string;
    tasks: string;
    recentCompletion: string;
    noRecentCompletion: string;
    blockers: string;
    noActiveBlockers: string;
    noExplicitBlocker: string;
    projectVersions: string;
    noProjectVersions: string;
    versionEmptyHint: string;
    decisions: string;
    noDecisions: string;
    decisionEmptyHint: string;
    recordedAtLabel: string;
    createdAtLabel: string;
    decidedAtLabel: string;
    categoryLabel: string;
  };
  revisions: {
    title: string;
    updatedSummary: (updatedAt: string, count: number) => string;
    currentVersion: string;
    viewRevision: string;
    compareCurrent: string;
    backToCurrent: string;
    live: string;
    historicalRevision: string;
    versionTime: (value: string) => string;
    previousVersion: string;
  };
  toasts: {
    docsUpdatedTitle: string;
    docsUpdatedOne: (preview: string) => string;
    docsUpdatedMany: (preview: string, count: number) => string;
    workspaceUpdatedTitle: string;
    workspaceUpdatedDescription: string;
  };
  status: {
    pending: string;
    in_progress: string;
    done: string;
    blocked: string;
    approved: string;
    rejected: string;
    draft: string;
    recorded: string;
  };
  sidebar: {
    unreadUpdate: string;
  };
}

const copy: Record<SiteLocale, SiteCopy> = {
  "zh-CN": {
    locale: "zh-CN",
    console: {
      projectLabel: "项目",
      projectFallback: "项目",
      missingProjectSummary: "当前工作区还没有结构化的项目介绍。",
      noEndGoal: "暂无最终目标",
      missingEndGoalSummary: "当前工作区还没有结构化的最终目标。",
      unknown: "unknown",
      readProjectOverview: "查看项目介绍",
      endGoal: "最终目标",
      progress: "进度",
      viewPlans: "查看计划",
      successCriteria: "完成标准",
      noSuccessCriteria: "尚未定义完成标准。",
      nonGoals: "明确不做什么",
      noNonGoals: "尚未定义非目标。",
      unreadChangedDocs: "未读变更文档",
      noUnreadChangedDocs: "当前没有未读文档变更。",
      recentChangedDocs: "最近变更文档",
      noRecentChangedDocs: "尚未产生共享文档变更历史。",
      changedAtLabel: "变更时间",
      planTree: "计划树",
      noTaskData: "当前没有可展示的任务数据。",
      noPlanData: "当前没有可展示的计划数据。",
      noPlanTasks: "该计划下暂无直接任务。",
      progressUnit: "进度单元",
      groupingNode: "分组节点",
      childPlans: "子计划",
      directTasks: "直接任务",
      plans: "计划",
      tasks: "任务",
      recentCompletion: "最近完成",
      noRecentCompletion: "尚未记录已完成工作。",
      blockers: "阻塞项",
      noActiveBlockers: "当前没有活跃阻塞项。",
      noExplicitBlocker: "No explicit blocker",
      projectVersions: "项目版本",
      noProjectVersions: "当前还没有项目级版本记录。",
      versionEmptyHint: "当项目进入新的整体成熟状态并值得长期保留时，再创建版本记录。",
      decisions: "决策",
      noDecisions: "当前还没有正式决策记录。",
      decisionEmptyHint: "只有高价值、低频、值得长期保留的项目决策才应记录为 decision。",
      recordedAtLabel: "记录时间",
      createdAtLabel: "创建时间",
      decidedAtLabel: "决策时间",
      categoryLabel: "类别"
    },
    revisions: {
      title: "Revision Line",
      updatedSummary: (updatedAt, count) => `最近更新于 ${updatedAt}，共 ${count} 个版本。`,
      currentVersion: "当前版本",
      viewRevision: "查看版本",
      compareCurrent: "对比当前",
      backToCurrent: "回到当前版本",
      live: "live",
      historicalRevision: "Historical Revision",
      versionTime: (value) => `版本时间 ${value}`,
      previousVersion: "历史版本"
    },
    toasts: {
      docsUpdatedTitle: "文档已更新",
      docsUpdatedOne: (preview) => `${preview} 有新修订。`,
      docsUpdatedMany: (preview, count) => `${preview} 等 ${count} 篇文档有新修订。`,
      workspaceUpdatedTitle: "工作区状态已更新",
      workspaceUpdatedDescription: "计划、任务或控制面状态发生了变化。"
    },
    status: {
      pending: "待处理",
      in_progress: "进行中",
      done: "已完成",
      blocked: "阻塞",
      approved: "已批准",
      rejected: "已拒绝",
      draft: "草稿",
      recorded: "已记录"
    },
    sidebar: {
      unreadUpdate: "未读更新"
    }
  },
  en: {
    locale: "en",
    console: {
      projectLabel: "Project",
      projectFallback: "Project",
      missingProjectSummary: "This workspace does not have a structured project overview yet.",
      noEndGoal: "No end goal",
      missingEndGoalSummary: "This workspace does not have a structured end goal yet.",
      unknown: "unknown",
      readProjectOverview: "Read project overview",
      endGoal: "End goal",
      progress: "Progress",
      viewPlans: "View plans",
      successCriteria: "Success criteria",
      noSuccessCriteria: "No success criteria are defined yet.",
      nonGoals: "Non-goals",
      noNonGoals: "No non-goals are defined yet.",
      unreadChangedDocs: "Unread changed docs",
      noUnreadChangedDocs: "There are no unread doc updates right now.",
      recentChangedDocs: "Recently changed docs",
      noRecentChangedDocs: "No authored docs have changed yet.",
      changedAtLabel: "Changed at",
      planTree: "Plan tree",
      noTaskData: "No task data is currently available.",
      noPlanData: "No plan data is currently available.",
      noPlanTasks: "No direct tasks are attached to this plan.",
      progressUnit: "Progress unit",
      groupingNode: "Grouping node",
      childPlans: "Child plans",
      directTasks: "Direct tasks",
      plans: "Plans",
      tasks: "Tasks",
      recentCompletion: "Recent completion",
      noRecentCompletion: "No completed work has been recorded yet.",
      blockers: "Blockers",
      noActiveBlockers: "No active blockers.",
      noExplicitBlocker: "暂无明确 blocker",
      projectVersions: "Project versions",
      noProjectVersions: "No project-level version records yet.",
      versionEmptyHint: "Record a version only when the project reaches a new overall state worth preserving.",
      decisions: "Decisions",
      noDecisions: "No formal decision records yet.",
      decisionEmptyHint: "Use decisions only for high-value, low-frequency choices worth preserving long term.",
      recordedAtLabel: "Recorded at",
      createdAtLabel: "Created at",
      decidedAtLabel: "Decided at",
      categoryLabel: "Category"
    },
    revisions: {
      title: "Revision Line",
      updatedSummary: (updatedAt, count) => `Updated ${updatedAt}, ${count} versions in total.`,
      currentVersion: "Current version",
      viewRevision: "View revision",
      compareCurrent: "Compare current",
      backToCurrent: "Back to current version",
      live: "live",
      historicalRevision: "Historical Revision",
      versionTime: (value) => `Version time ${value}`,
      previousVersion: "Previous version"
    },
    toasts: {
      docsUpdatedTitle: "Docs updated",
      docsUpdatedOne: (preview) => `${preview} has a new revision.`,
      docsUpdatedMany: (preview, count) => `${preview} and ${count - 1} more docs have new revisions.`,
      workspaceUpdatedTitle: "Workspace updated",
      workspaceUpdatedDescription: "Plans, tasks, or control-plane state changed."
    },
    status: {
      pending: "pending",
      in_progress: "in progress",
      done: "done",
      blocked: "blocked",
      approved: "approved",
      rejected: "rejected",
      draft: "draft",
      recorded: "recorded"
    },
    sidebar: {
      unreadUpdate: "Unread update"
    }
  }
};

export function getSiteCopy(locale: SiteLocale): SiteCopy {
  return copy[locale];
}

export function formatSiteDate(
  locale: SiteLocale,
  value: string,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(copy[locale].locale, options).format(new Date(value));
}

export const docsHref = docsPathToHref;
