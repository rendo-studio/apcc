import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  Circle,
  Clock3,
  Download,
  FileClock,
  FileText,
  Filter,
  GitBranch,
  Layers3,
  ListChecks,
  Plus,
  Search,
  Send,
  UserCircle
} from "lucide-react";

import type { ConsoleSection } from "../../lib/console-routes";
import { consoleSectionHref } from "../../lib/console-routes";
import type { SiteLocale } from "../../lib/i18n";
import type { ControlPlaneSnapshot, RuntimeDocPage } from "../../lib/runtime-data";
import { formatSiteDate, getSiteCopy } from "../../lib/site-copy";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { docsPathToHref } from "./docs-rail-shared";
import { ConsoleSidebarLayout } from "./console-sidebar-layout";

type RuntimePlan = NonNullable<ControlPlaneSnapshot["plans"]>["items"][number];
type RuntimeTask = NonNullable<ControlPlaneSnapshot["tasks"]>["items"][number];
type RuntimeDecision = NonNullable<ControlPlaneSnapshot["decisions"]>["items"][number];
type RuntimeVersion = NonNullable<ControlPlaneSnapshot["versions"]>["items"][number];

type Priority = "high" | "medium" | "low";

const detailCopy = {
  "zh-CN": {
    overview: "总览",
    nav: {
      plans: "计划与任务",
      blockers: "阻塞项",
      changes: "变更历史",
      decisions: "决策记录",
      versions: "版本记录"
    },
    pages: {
      plans: {
        title: "计划与任务",
        subtitle: "集中管理计划、任务、负责人、时间与执行状态",
        primaryAction: "新建任务",
        secondaryAction: "导出列表",
        search: "搜索任务名称或备注..."
      },
      blockers: {
        title: "阻塞项",
        subtitle: "跟踪影响交付的风险、问题与待解决事项",
        primaryAction: "新建阻塞项",
        secondaryAction: "导出",
        search: "搜索阻塞项关键词..."
      },
      changes: {
        title: "变更历史",
        subtitle: "查看文档、页面、版本与任务的历史变更记录",
        primaryAction: "导出记录",
        secondaryAction: "订阅通知",
        search: "搜索变更内容、标题或执行人..."
      },
      decisions: {
        title: "决策记录",
        subtitle: "记录关键方案、评审结论与项目范围内的重要决策",
        primaryAction: "新增决策",
        secondaryAction: "筛选",
        search: "搜索决策标题或关键词"
      },
      versions: {
        title: "版本记录",
        subtitle: "查看发布版本、变更摘要、里程碑与升级说明",
        primaryAction: "创建版本",
        secondaryAction: "发布说明模板",
        search: "搜索版本或发布说明..."
      }
    },
    metrics: {
      allTasks: "全部任务",
      inProgress: "进行中",
      completed: "已完成",
      blocked: "已阻塞",
      highPriority: "高优先级",
      processing: "处理中",
      waiting: "待确认",
      todayChanges: "今日变更",
      weekChanges: "本周变更",
      docUpdates: "文档更新",
      pageAdds: "页面新增",
      approved: "已通过",
      reviewing: "评审中",
      archived: "待归档",
      currentVersion: "当前版本",
      totalVersions: "累计版本",
      monthRelease: "本月发布",
      pendingRelease: "待发布"
    },
    tabs: {
      all: "全部",
      plans: "计划",
      tasks: "任务",
      completed: "已完成",
      blocked: "已阻塞",
      architecture: "架构",
      flow: "流程",
      permission: "权限",
      high: "高优先级",
      newThisWeek: "本周新增"
    },
    fields: {
      assignee: "负责人",
      priority: "优先级",
      status: "状态",
      plan: "关联计划",
      dueDate: "截止时间",
      createdAt: "创建时间",
      updatedAt: "更新时间",
      releasedAt: "发布于",
      progress: "进度",
      total: "共 {count} 项",
      viewAll: "查看全部",
      relatedDocs: "相关文档",
      noData: "暂无可展示数据",
      uncategorized: "未分类",
      current: "当前版本",
      official: "正式",
      draft: "草稿",
      category: "类别"
    },
    priorities: {
      high: "高",
      medium: "中",
      low: "低"
    },
    rails: {
      upcoming: "即将到期",
      myTasks: "我的任务",
      planProgress: "计划进度",
      selectedBlocker: "阻塞详情",
      processSteps: "处理步骤",
      latestDiscussion: "最新讨论",
      changeCategory: "变更分类",
      notificationSettings: "通知设置",
      decisionMilestone: "决策里程碑",
      releaseRhythm: "发布节奏",
      currentNotes: "当前版本说明"
    },
    empty: {
      plans: "当前没有计划数据。",
      blockers: "当前没有活跃阻塞项。",
      changes: "尚未产生文档变更历史。",
      decisions: "当前还没有正式决策记录。",
      versions: "当前还没有项目级版本记录。"
    },
    synthetic: {
      owner: "李明",
      dateOne: "5月20日",
      dateTwo: "5月24日",
      dateThree: "5月28日",
      noBlockerDescription: "没有需要单独处理的交付风险。",
      notificationOne: "变更摘要通知",
      notificationTwo: "重要变更即时通知",
      notificationThree: "任务变更通知"
    }
  },
  en: {
    overview: "Overview",
    nav: {
      plans: "Plans & Tasks",
      blockers: "Blockers",
      changes: "Change History",
      decisions: "Decisions",
      versions: "Versions"
    },
    pages: {
      plans: {
        title: "Plans & Tasks",
        subtitle: "Manage plans, tasks, owners, timing, and execution status",
        primaryAction: "New Task",
        secondaryAction: "Export List",
        search: "Search tasks or notes..."
      },
      blockers: {
        title: "Blockers",
        subtitle: "Track delivery risks, issues, and pending resolution work",
        primaryAction: "New Blocker",
        secondaryAction: "Export",
        search: "Search blockers..."
      },
      changes: {
        title: "Change History",
        subtitle: "Review historical changes across docs, pages, versions, and tasks",
        primaryAction: "Export Records",
        secondaryAction: "Subscribe",
        search: "Search changes, titles, or actors..."
      },
      decisions: {
        title: "Decisions",
        subtitle: "Record key proposals, review outcomes, and project-scope decisions",
        primaryAction: "New Decision",
        secondaryAction: "Filter",
        search: "Search decisions or keywords"
      },
      versions: {
        title: "Versions",
        subtitle: "Review releases, summaries, milestones, and upgrade notes",
        primaryAction: "Create Version",
        secondaryAction: "Release Template",
        search: "Search versions or notes..."
      }
    },
    metrics: {
      allTasks: "All Tasks",
      inProgress: "In Progress",
      completed: "Completed",
      blocked: "Blocked",
      highPriority: "High Priority",
      processing: "Processing",
      waiting: "Waiting",
      todayChanges: "Today",
      weekChanges: "This Week",
      docUpdates: "Doc Updates",
      pageAdds: "Page Adds",
      approved: "Approved",
      reviewing: "Reviewing",
      archived: "To Archive",
      currentVersion: "Current Version",
      totalVersions: "Total Versions",
      monthRelease: "This Month",
      pendingRelease: "Pending"
    },
    tabs: {
      all: "All",
      plans: "Plans",
      tasks: "Tasks",
      completed: "Completed",
      blocked: "Blocked",
      architecture: "Architecture",
      flow: "Flow",
      permission: "Permission",
      high: "High Priority",
      newThisWeek: "New This Week"
    },
    fields: {
      assignee: "Owner",
      priority: "Priority",
      status: "Status",
      plan: "Plan",
      dueDate: "Due",
      createdAt: "Created",
      updatedAt: "Updated",
      releasedAt: "Released",
      progress: "Progress",
      total: "{count} items",
      viewAll: "View all",
      relatedDocs: "Related Docs",
      noData: "No data available",
      uncategorized: "Uncategorized",
      current: "Current",
      official: "Official",
      draft: "Draft",
      category: "Category"
    },
    priorities: {
      high: "High",
      medium: "Medium",
      low: "Low"
    },
    rails: {
      upcoming: "Due Soon",
      myTasks: "My Tasks",
      planProgress: "Plan Progress",
      selectedBlocker: "Blocker Detail",
      processSteps: "Process Steps",
      latestDiscussion: "Latest Discussion",
      changeCategory: "Change Category",
      notificationSettings: "Notifications",
      decisionMilestone: "Decision Milestone",
      releaseRhythm: "Release Rhythm",
      currentNotes: "Current Notes"
    },
    empty: {
      plans: "No plan data is available.",
      blockers: "No active blockers.",
      changes: "No authored docs have changed yet.",
      decisions: "No formal decision records yet.",
      versions: "No project-level version records yet."
    },
    synthetic: {
      owner: "Maintainers",
      dateOne: "May 20",
      dateTwo: "May 24",
      dateThree: "May 28",
      noBlockerDescription: "There are no delivery risks requiring dedicated handling.",
      notificationOne: "Change digest",
      notificationTwo: "Important changes",
      notificationThree: "Task changes"
    }
  }
} satisfies Record<SiteLocale, object>;

const assigneesByLocale: Record<SiteLocale, string[]> = {
  "zh-CN": ["张伟", "王芳", "李明", "赵磊", "陈晨"],
  en: ["Alex", "Morgan", "Jordan", "Taylor", "Casey"]
};

const dueDatesByLocale: Record<SiteLocale, string[]> = {
  "zh-CN": ["5月20日", "5月24日", "5月26日", "5月28日", "5月30日"],
  en: ["May 20", "May 24", "May 26", "May 28", "May 30"]
};

function replaceCount(template: string, count: number): string {
  return template.replace("{count}", String(count));
}

function formatTimestamp(
  locale: SiteLocale,
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    month: "numeric",
    day: "numeric"
  }
): string {
  if (!value) {
    return locale === "zh-CN" ? "未知" : "Unknown";
  }

  return formatSiteDate(locale, value, options);
}

function formatMonthDayTime(locale: SiteLocale, value: string | null | undefined): string {
  return formatTimestamp(locale, value, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function statusTone(status: string): string {
  if (status === "done" || status === "approved" || status === "recorded") {
    return "border-green-100 bg-green-50 text-green-700 dark:border-green-400/20 dark:bg-green-500/10 dark:text-green-300";
  }

  if (status === "in_progress") {
    return "border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300";
  }

  if (status === "blocked" || status === "rejected") {
    return "border-red-100 bg-red-50 text-red-600 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300";
  }

  return "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300";
}

function statusDot(status: string): string {
  if (status === "done" || status === "approved" || status === "recorded") {
    return "bg-green-600";
  }

  if (status === "in_progress") {
    return "bg-blue-600";
  }

  if (status === "blocked" || status === "rejected") {
    return "bg-red-500";
  }

  return "bg-slate-400";
}

function priorityForIndex(index: number): Priority {
  return index === 0 ? "high" : index % 3 === 0 ? "low" : "medium";
}

function priorityTone(priority: Priority): string {
  if (priority === "high") {
    return "border-red-100 bg-red-50 text-red-600 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300";
  }

  if (priority === "medium") {
    return "border-orange-100 bg-orange-50 text-orange-600 dark:border-orange-400/20 dark:bg-orange-500/10 dark:text-orange-300";
  }

  return "border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300";
}

function StatusPill({ status, locale }: { status: string; locale: SiteLocale }) {
  const labels = getSiteCopy(locale).status;
  const label = status in labels ? labels[status as keyof typeof labels] : status.replaceAll("_", " ");

  return (
    <Badge className={cn("gap-2 px-2.5 py-1", statusTone(status))}>
      <span className={cn("size-1.5 rounded-full", statusDot(status))} />
      {label}
    </Badge>
  );
}

function PriorityPill({ priority, locale }: { priority: Priority; locale: SiteLocale }) {
  const copy = detailCopy[locale];

  return (
    <Badge className={cn("px-2.5 py-1", priorityTone(priority))}>
      {copy.priorities[priority]}
    </Badge>
  );
}

function Surface({
  children,
  className,
  id
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-neutral-950",
        className
      )}
    >
      {children}
    </section>
  );
}

function SectionHeader({
  title,
  description,
  icon,
  actionHref,
  actionLabel
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10">
          {icon}
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
      </div>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-blue-600">
          {actionLabel}
          <ArrowRight className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}

function ActionButton({
  children,
  icon,
  primary
}: {
  children: ReactNode;
  icon: ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        primary
          ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
          : "border-blue-600 bg-white text-blue-600 hover:bg-blue-50 dark:bg-neutral-950 dark:hover:bg-blue-500/10"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon,
  tone
}: {
  label: string;
  value: ReactNode;
  note?: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <Surface className="px-5 py-5">
      <div className="flex items-center gap-4">
        <span className={cn("inline-flex size-12 shrink-0 items-center justify-center rounded-full", tone)}>{icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-500">{label}</div>
          <div className="mt-1 text-3xl font-bold leading-none tracking-normal text-slate-950 dark:text-white">{value}</div>
          {note ? <div className="mt-2 text-xs text-slate-500">{note}</div> : null}
        </div>
      </div>
    </Surface>
  );
}

function FilterBar({
  search,
  children
}: {
  search: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-neutral-950">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-10 min-w-64 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-400 dark:border-white/10 dark:bg-neutral-950">
          <Search className="size-4 shrink-0" />
          <span className="truncate">{search}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function SelectChip({ label }: { label: string }) {
  return (
    <span className="inline-flex h-10 min-w-32 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-500 dark:border-white/10 dark:bg-neutral-950">
      {label}
      <ArrowRight className="size-3.5 rotate-90" />
    </span>
  );
}

function ToggleChip({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-medium",
        active
          ? "border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-400/40 dark:bg-blue-500/10"
          : "border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-neutral-950 dark:text-slate-300"
      )}
    >
      {label}
    </span>
  );
}

function Person({
  name,
  index
}: {
  name: string;
  index: number;
}) {
  const tones = [
    "bg-blue-50 text-blue-600",
    "bg-green-50 text-green-700",
    "bg-orange-50 text-orange-700",
    "bg-violet-50 text-violet-700"
  ];

  return (
    <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
      <span className={cn("inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold", tones[index % tones.length])}>
        {name.slice(0, 1)}
      </span>
      <span className="truncate">{name}</span>
    </span>
  );
}

function getPlanProgress(plan: RuntimePlan, tasks: RuntimeTask[]): { total: number; done: number; percent: number } {
  const scoped = tasks.filter((task) => task.planRef === plan.id && task.countedForProgress);
  const done = scoped.filter((task) => task.status === "done").length;

  return {
    total: scoped.length,
    done,
    percent: scoped.length > 0 ? Math.round((done / scoped.length) * 100) : plan.status === "done" ? 100 : 0
  };
}

function planPriority(plan: RuntimePlan): number {
  if (plan.status === "in_progress") {
    return 0;
  }

  if (plan.status === "blocked") {
    return 1;
  }

  if (plan.status === "pending") {
    return 2;
  }

  return 3;
}

function sortedPlans(snapshot: ControlPlaneSnapshot): RuntimePlan[] {
  return [...(snapshot.plans?.items ?? [])].sort((left, right) => planPriority(left) - planPriority(right));
}

function sortedChanges(snapshot: ControlPlaneSnapshot): RuntimeDocPage[] {
  return [...snapshot.docs.changedPages].sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""));
}

function sortedDecisions(snapshot: ControlPlaneSnapshot): RuntimeDecision[] {
  return [...(snapshot.decisions?.items ?? [])].sort((left, right) =>
    (right.decidedAt ?? right.createdAt).localeCompare(left.decidedAt ?? left.createdAt)
  );
}

function sortedVersions(snapshot: ControlPlaneSnapshot): RuntimeVersion[] {
  return [...(snapshot.versions?.items ?? [])].sort((left, right) =>
    (right.recordedAt ?? right.createdAt).localeCompare(left.recordedAt ?? left.createdAt)
  );
}

function activeBlockers(snapshot: ControlPlaneSnapshot, locale: SiteLocale): string[] {
  const copy = getSiteCopy(locale);
  return (snapshot.tasks?.blockers ?? snapshot.status?.blockers ?? []).filter(
    (item) => ![copy.console.noExplicitBlocker, "No explicit blocker", "暂无明确 blocker"].includes(item)
  );
}

function taskCounts(tasks: RuntimeTask[]) {
  const counted = tasks.filter((task) => task.countedForProgress);

  return {
    total: counted.length,
    inProgress: counted.filter((task) => task.status === "in_progress").length,
    done: counted.filter((task) => task.status === "done").length,
    blocked: counted.filter((task) => task.status === "blocked").length
  };
}

function isSameMonth(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  const now = new Date();

  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function metricCards(section: ConsoleSection, locale: SiteLocale, snapshot: ControlPlaneSnapshot) {
  const copy = detailCopy[locale];
  const tasks = snapshot.tasks?.items ?? [];
  const counts = taskCounts(tasks);
  const blockers = activeBlockers(snapshot, locale);
  const changes = sortedChanges(snapshot);
  const decisions = sortedDecisions(snapshot);
  const versions = sortedVersions(snapshot);

  if (section === "plans") {
    return [
      { label: copy.metrics.allTasks, value: counts.total, icon: <CheckSquare className="size-5" />, tone: "bg-blue-50 text-blue-600" },
      { label: copy.metrics.inProgress, value: counts.inProgress, icon: <Send className="size-5" />, tone: "bg-green-50 text-green-700" },
      { label: copy.metrics.completed, value: counts.done, icon: <CheckCircle2 className="size-5" />, tone: "bg-blue-50 text-blue-600" },
      { label: copy.metrics.blocked, value: counts.blocked, icon: <AlertTriangle className="size-5" />, tone: "bg-red-50 text-red-600" }
    ];
  }

  if (section === "blockers") {
    return [
      { label: copy.metrics.highPriority, value: blockers.length > 0 ? 1 : 0, icon: <AlertTriangle className="size-5" />, tone: "bg-red-50 text-red-600" },
      { label: copy.metrics.processing, value: blockers.length, icon: <Clock3 className="size-5" />, tone: "bg-blue-50 text-blue-600" },
      { label: copy.metrics.waiting, value: 0, icon: <Circle className="size-5" />, tone: "bg-orange-50 text-orange-600" }
    ];
  }

  if (section === "changes") {
    return [
      { label: copy.metrics.todayChanges, value: changes.slice(0, 6).length, icon: <FileText className="size-5" />, tone: "bg-blue-50 text-blue-600" },
      { label: copy.metrics.weekChanges, value: changes.length, icon: <CalendarClock className="size-5" />, tone: "bg-green-50 text-green-700" },
      { label: copy.metrics.docUpdates, value: changes.length, icon: <FileClock className="size-5" />, tone: "bg-violet-50 text-violet-700" },
      { label: copy.metrics.pageAdds, value: Math.min(3, changes.length), icon: <Layers3 className="size-5" />, tone: "bg-orange-50 text-orange-600" }
    ];
  }

  if (section === "decisions") {
    return [
      { label: copy.metrics.approved, value: decisions.filter((decision) => decision.status === "approved").length, icon: <CheckCircle2 className="size-5" />, tone: "bg-green-50 text-green-700" },
      { label: copy.metrics.reviewing, value: decisions.filter((decision) => decision.status === "pending").length, icon: <Clock3 className="size-5" />, tone: "bg-orange-50 text-orange-600" },
      { label: copy.metrics.archived, value: decisions.filter((decision) => decision.status === "rejected").length, icon: <FileText className="size-5" />, tone: "bg-blue-50 text-blue-600" }
    ];
  }

  const current = versions[0]?.version ?? "-";

  return [
    { label: copy.metrics.currentVersion, value: current, note: versions[0] ? copy.fields.current : undefined, icon: <GitBranch className="size-5" />, tone: "bg-blue-50 text-blue-600" },
    { label: copy.metrics.totalVersions, value: versions.length, icon: <Layers3 className="size-5" />, tone: "bg-blue-50 text-blue-600" },
    { label: copy.metrics.monthRelease, value: versions.filter((version) => isSameMonth(version.recordedAt ?? version.createdAt)).length, icon: <CalendarClock className="size-5" />, tone: "bg-green-50 text-green-700" },
    { label: copy.metrics.pendingRelease, value: versions.filter((version) => version.status === "draft").length, icon: <Send className="size-5" />, tone: "bg-orange-50 text-orange-600" }
  ];
}

function renderPlans(locale: SiteLocale, snapshot: ControlPlaneSnapshot) {
  const copy = detailCopy[locale];
  const tasks = snapshot.tasks?.items ?? [];
  const plans = sortedPlans(snapshot);
  const assignees = assigneesByLocale[locale];
  const dates = dueDatesByLocale[locale];
  const activeTasks = tasks.filter((task) => task.status !== "done" && task.countedForProgress).slice(0, 5);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.9fr)]">
      <div className="min-w-0">
        <FilterBar search={copy.pages.plans.search}>
          <SelectChip label={`${copy.fields.assignee}: ${copy.tabs.all}`} />
          <SelectChip label={`${copy.fields.priority}: ${copy.tabs.all}`} />
          <SelectChip label={`${copy.fields.status}: ${copy.tabs.all}`} />
          <ToggleChip label={copy.tabs.all} active />
          <ToggleChip label={copy.tabs.plans} />
          <ToggleChip label={copy.tabs.tasks} />
          <ToggleChip label={copy.tabs.completed} />
          <ToggleChip label={copy.tabs.blocked} />
        </FilterBar>

        <Surface className="px-4 py-4">
          <SectionHeader title={copy.nav.plans} description={replaceCount(copy.fields.total, plans.length)} icon={<ListChecks className="size-5" />} />
          {plans.length === 0 ? (
            <div className="rounded-lg border border-slate-200 px-4 py-10 text-sm text-slate-500 dark:border-white/10">
              {copy.empty.plans}
            </div>
          ) : (
            <div className="space-y-3">
              {plans.slice(0, 8).map((plan, planIndex) => {
                const progress = getPlanProgress(plan, tasks);
                const scopedTasks = tasks.filter((task) => task.planRef === plan.id).slice(0, 5);

                return (
                  <div key={plan.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-neutral-950">
                    <div className="grid gap-3 border-b border-slate-200 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_12rem_4rem_4rem] md:items-center dark:border-white/10">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-slate-950 dark:text-white">{plan.name}</div>
                        {plan.summary ? <div className="mt-1 line-clamp-1 text-sm text-slate-500">{plan.summary}</div> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{copy.fields.progress}</span>
                        <Progress value={progress.percent} className="h-2 flex-1 bg-slate-200" />
                      </div>
                      <span className="font-medium text-slate-700 dark:text-slate-200">{progress.percent}%</span>
                      <StatusPill status={plan.status} locale={locale} />
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-white/10">
                      {scopedTasks.length ? (
                        scopedTasks.map((task, taskIndex) => (
                          <div
                            key={task.id}
                            className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[2rem_minmax(0,1fr)_7rem_8rem_6rem] md:items-center"
                          >
                            <span className="hidden text-slate-300 md:inline-flex">::</span>
                            <span className="min-w-0 truncate font-medium text-slate-800 dark:text-slate-100">{task.name}</span>
                            <Person name={assignees[(planIndex + taskIndex) % assignees.length]} index={taskIndex} />
                            <StatusPill status={task.status} locale={locale} />
                            <span className="text-slate-500">{dates[(planIndex + taskIndex) % dates.length]}</span>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-4 text-sm text-slate-500">{copy.empty.plans}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Surface>
      </div>

      <div className="space-y-5">
        <Surface className="px-4 py-4">
          <SectionHeader title={copy.rails.upcoming} icon={<Clock3 className="size-5" />} actionHref={consoleSectionHref(locale, "plans")} actionLabel={copy.fields.viewAll} />
          <div className="divide-y divide-slate-200 dark:divide-white/10">
            {activeTasks.length ? (
              activeTasks.slice(0, 4).map((task, index) => (
                <div key={task.id} className="flex items-center gap-3 py-3 text-sm">
                  <span className={cn("size-2 rounded-full", task.status === "blocked" ? "bg-red-500" : "bg-blue-600")} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-900 dark:text-white">{task.name}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">{plans.find((plan) => plan.id === task.planRef)?.name ?? copy.nav.plans}</div>
                  </div>
                  <span className="text-slate-500">{dates[index % dates.length]}</span>
                </div>
              ))
            ) : (
              <div className="py-6 text-sm text-slate-500">{copy.fields.noData}</div>
            )}
          </div>
        </Surface>

        <Surface className="px-4 py-4">
          <SectionHeader title={copy.rails.myTasks} icon={<UserCircle className="size-5" />} actionHref={consoleSectionHref(locale, "plans")} actionLabel={copy.fields.viewAll} />
          <div className="space-y-3">
            {activeTasks.slice(0, 3).map((task, index) => (
              <div key={task.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm dark:border-white/10">
                <span className="inline-flex size-5 items-center justify-center rounded border border-slate-300">
                  {index === 2 ? <CheckSquare className="size-3.5 text-blue-600" /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-900 dark:text-white">{task.name}</div>
                  <div className="truncate text-xs text-slate-500">{plans.find((plan) => plan.id === task.planRef)?.name ?? copy.nav.plans}</div>
                </div>
                <PriorityPill priority={priorityForIndex(index)} locale={locale} />
              </div>
            ))}
          </div>
        </Surface>

        <Surface className="px-4 py-4">
          <SectionHeader title={copy.rails.planProgress} icon={<Layers3 className="size-5" />} />
          <div className="space-y-4">
            {plans.slice(0, 5).map((plan) => {
              const progress = getPlanProgress(plan, tasks);
              return (
                <div key={plan.id} className="grid grid-cols-[minmax(0,1fr)_3rem_8rem] items-center gap-3 text-sm">
                  <span className="truncate text-slate-700 dark:text-slate-200">{plan.name}</span>
                  <span className="text-right text-slate-500">{progress.percent}%</span>
                  <Progress value={progress.percent} className="h-2 bg-slate-200" />
                </div>
              );
            })}
          </div>
        </Surface>
      </div>
    </div>
  );
}

function renderBlockers(locale: SiteLocale, snapshot: ControlPlaneSnapshot) {
  const copy = detailCopy[locale];
  const plans = sortedPlans(snapshot);
  const blockers = activeBlockers(snapshot, locale);
  const assignees = assigneesByLocale[locale];
  const selected = blockers[0] ?? null;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(24rem,0.85fr)]">
      <div className="min-w-0">
        <FilterBar search={copy.pages.blockers.search}>
          <SelectChip label={`${copy.fields.status}: ${copy.tabs.all}`} />
          <SelectChip label={`${copy.fields.priority}: ${copy.tabs.all}`} />
          <SelectChip label={`${copy.fields.plan}: ${copy.tabs.all}`} />
          <ToggleChip label={copy.tabs.all} active />
          <ToggleChip label={copy.tabs.high} />
          <ToggleChip label={copy.tabs.newThisWeek} />
        </FilterBar>

        <Surface className="px-4 py-4">
          <SectionHeader title={copy.nav.blockers} description={replaceCount(copy.fields.total, blockers.length)} icon={<AlertTriangle className="size-5 text-red-500" />} />
          {blockers.length ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
              {blockers.map((blocker, index) => (
                <div
                  key={blocker}
                  className={cn(
                    "grid gap-4 border-b border-slate-200 px-4 py-4 text-sm last:border-b-0 md:grid-cols-[minmax(0,1fr)_10rem_8rem_7rem] md:items-center dark:border-white/10",
                    index === 0 && "bg-blue-50/50 dark:bg-blue-500/10"
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className={cn("size-3 rounded-full border", index === 0 ? "border-blue-600 bg-blue-600" : "border-slate-300")} />
                      <span className="truncate font-semibold text-slate-950 dark:text-white">{blocker}</span>
                    </div>
                    <div className="mt-1 truncate pl-6 text-xs text-slate-500">{plans[index % Math.max(plans.length, 1)]?.name ?? copy.nav.plans}</div>
                  </div>
                  <Person name={assignees[index % assignees.length]} index={index} />
                  <PriorityPill priority={priorityForIndex(index)} locale={locale} />
                  <StatusPill status="in_progress" locale={locale} />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-white/10">
              {copy.empty.blockers}
            </div>
          )}
        </Surface>
      </div>

      <div className="space-y-5">
        <Surface className="px-5 py-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                {selected ?? copy.rails.selectedBlocker}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {selected ? copy.pages.blockers.subtitle : copy.synthetic.noBlockerDescription}
              </p>
            </div>
            {selected ? <StatusPill status="in_progress" locale={locale} /> : null}
          </div>
          <div className="space-y-3 border-t border-slate-200 pt-4 text-sm dark:border-white/10">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">{copy.fields.plan}</span>
              <span className="font-medium text-blue-600">{plans[0]?.name ?? copy.nav.plans}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">{copy.fields.assignee}</span>
              <Person name={assignees[0]} index={0} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">{copy.fields.priority}</span>
              <PriorityPill priority="high" locale={locale} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">{copy.fields.dueDate}</span>
              <span className="font-medium text-slate-900 dark:text-white">{copy.synthetic.dateThree}</span>
            </div>
          </div>
        </Surface>

        <Surface className="px-5 py-5">
          <SectionHeader title={copy.rails.processSteps} icon={<CheckSquare className="size-5" />} />
          <div className="space-y-3 text-sm">
            {[copy.pages.blockers.subtitle, copy.nav.plans, copy.fields.viewAll, copy.fields.current].map((item, index) => (
              <div key={`${item}-${index}`} className="flex items-center gap-3">
                <span className={cn("inline-flex size-5 items-center justify-center rounded-full border", index < 2 ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300")}>
                  {index < 2 ? <CheckCircle2 className="size-3.5" /> : null}
                </span>
                <span className={index < 2 ? "text-slate-900 dark:text-white" : "text-slate-500"}>{item}</span>
              </div>
            ))}
          </div>
        </Surface>

        <Surface className="px-5 py-5">
          <SectionHeader title={copy.rails.latestDiscussion} icon={<Bell className="size-5" />} actionHref={consoleSectionHref(locale, "blockers")} actionLabel={copy.fields.viewAll} />
          <div className="space-y-4 text-sm">
            {assignees.slice(0, 2).map((name, index) => (
              <div key={name} className="flex gap-3">
                <Person name={name} index={index} />
                <p className="min-w-0 flex-1 leading-6 text-slate-500">{index === 0 ? copy.pages.blockers.subtitle : copy.synthetic.noBlockerDescription}</p>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
}

function renderChanges(locale: SiteLocale, snapshot: ControlPlaneSnapshot) {
  const copy = detailCopy[locale];
  const changes = sortedChanges(snapshot);
  const assignees = assigneesByLocale[locale];
  const typeLabels = locale === "zh-CN"
    ? ["文档更新", "页面新增", "版本发布", "任务完成"]
    : ["Doc update", "Page add", "Version release", "Task completed"];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(24rem,0.8fr)]">
      <div className="min-w-0">
        <FilterBar search={copy.pages.changes.search}>
          <SelectChip label={locale === "zh-CN" ? "日期范围" : "Date range"} />
          <SelectChip label={`${copy.fields.category}: ${copy.tabs.all}`} />
          <SelectChip label={`${copy.fields.assignee}: ${copy.tabs.all}`} />
        </FilterBar>

        <Surface className="px-5 py-5">
          <SectionHeader title={copy.nav.changes} description={replaceCount(copy.fields.total, changes.length)} icon={<FileClock className="size-5" />} />
          {changes.length ? (
            <div className="relative space-y-1 border-l border-blue-100 pl-6 dark:border-blue-400/20">
              {changes.slice(0, 12).map((page, index) => (
                <Link
                  key={page.path}
                  href={docsPathToHref(locale, page.path)}
                  className="group relative grid gap-3 border-b border-slate-100 py-4 text-sm last:border-b-0 md:grid-cols-[7rem_minmax(0,1fr)_7rem_6rem_1.5rem] md:items-center dark:border-white/10"
                >
                  <span className="absolute -left-[1.85rem] top-5 size-2.5 rounded-full bg-blue-600 ring-4 ring-white dark:ring-neutral-950" />
                  <Person name={assignees[index % assignees.length]} index={index} />
                  <span className="min-w-0 truncate font-medium text-slate-800 group-hover:text-blue-600 dark:text-slate-100">{page.title}</span>
                  <Badge className={cn("justify-center", index % 4 === 1 ? "border-green-100 bg-green-50 text-green-700" : index % 4 === 2 ? "border-violet-100 bg-violet-50 text-violet-700" : index % 4 === 3 ? "border-orange-100 bg-orange-50 text-orange-700" : "border-blue-100 bg-blue-50 text-blue-700")}>
                    {typeLabels[index % typeLabels.length]}
                  </Badge>
                  <span className="text-right text-slate-500">{formatMonthDayTime(locale, page.updatedAt)}</span>
                  <ArrowRight className="hidden size-4 text-slate-400 group-hover:text-blue-600 md:block" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-white/10">
              {copy.empty.changes}
            </div>
          )}
        </Surface>
      </div>

      <div className="space-y-5">
        <Surface className="px-5 py-5">
          <SectionHeader title={copy.rails.changeCategory} icon={<Layers3 className="size-5" />} actionHref={consoleSectionHref(locale, "changes")} actionLabel={copy.fields.viewAll} />
          <div className="space-y-4">
            {typeLabels.map((label, index) => {
              const value = changes.length === 0 ? 0 : Math.max(15, 45 - index * 10);
              const tone = index === 0 ? "bg-blue-600" : index === 1 ? "bg-green-600" : index === 2 ? "bg-violet-600" : "bg-orange-500";
              return (
                <div key={label} className="grid grid-cols-[5rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm">
                  <span className="text-slate-700 dark:text-slate-200">{label}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <span className={cn("block h-full rounded-full", tone)} style={{ width: `${value}%` }} />
                  </span>
                  <span className="text-right text-slate-500">{value}%</span>
                </div>
              );
            })}
          </div>
        </Surface>

        <Surface className="px-5 py-5">
          <SectionHeader title={copy.rails.notificationSettings} icon={<Bell className="size-5" />} />
          <div className="divide-y divide-slate-200 text-sm dark:divide-white/10">
            {[copy.synthetic.notificationOne, copy.synthetic.notificationTwo, copy.synthetic.notificationThree].map((label, index) => (
              <div key={label} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">{label}</div>
                  <div className="mt-1 text-xs text-slate-500">{copy.pages.changes.subtitle}</div>
                </div>
                <span className={cn("inline-flex h-6 w-11 items-center rounded-full p-1", index < 2 ? "bg-blue-600" : "bg-slate-300")}>
                  <span className={cn("size-4 rounded-full bg-white transition", index < 2 && "translate-x-5")} />
                </span>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
}

function renderDecisions(locale: SiteLocale, snapshot: ControlPlaneSnapshot) {
  const copy = detailCopy[locale];
  const decisions = sortedDecisions(snapshot);
  const selected = decisions[0] ?? null;
  const assignees = assigneesByLocale[locale];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="min-w-0">
        <FilterBar search={copy.pages.decisions.search}>
          <ToggleChip label={copy.tabs.all} active />
          <ToggleChip label={copy.tabs.architecture} />
          <ToggleChip label={copy.tabs.flow} />
          <ToggleChip label={copy.tabs.permission} />
        </FilterBar>

        <Surface className="px-4 py-4">
          <SectionHeader title={copy.nav.decisions} description={replaceCount(copy.fields.total, decisions.length)} icon={<FileText className="size-5" />} />
          {decisions.length ? (
            <div className="space-y-3">
              {decisions.map((decision, index) => {
                const content = (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="min-w-0 truncate text-base font-semibold text-slate-950 dark:text-white">{decision.name}</h3>
                      <StatusPill status={decision.status} locale={locale} />
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{decision.description}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                      <Badge className="border-blue-100 bg-blue-50 text-blue-600">{decision.category || copy.fields.uncategorized}</Badge>
                      <span>{formatTimestamp(locale, decision.decidedAt ?? decision.createdAt)}</span>
                      <span>{copy.fields.plan}: {snapshot.plans?.items[index % Math.max(snapshot.plans.items.length, 1)]?.name ?? copy.nav.plans}</span>
                    </div>
                  </>
                );

                return decision.docPath ? (
                  <Link
                    key={decision.id}
                    href={docsPathToHref(locale, decision.docPath)}
                    className={cn("block rounded-xl border p-4 transition hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-500/10", index === 0 ? "border-blue-400" : "border-slate-200 dark:border-white/10")}
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={decision.id} className={cn("rounded-xl border p-4", index === 0 ? "border-blue-400" : "border-slate-200 dark:border-white/10")}>
                    {content}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-white/10">
              {copy.empty.decisions}
            </div>
          )}
        </Surface>
      </div>

      <Surface className="px-6 py-6">
        {selected ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-white/10">
              <div>
                <h2 className="text-2xl font-semibold tracking-normal text-slate-950 dark:text-white">{selected.name}</h2>
                <div className="mt-4 flex flex-wrap gap-5 text-sm text-slate-500">
                  <span>{formatTimestamp(locale, selected.decidedAt ?? selected.createdAt)}</span>
                  <Person name={assignees[0]} index={0} />
                  <span>{copy.fields.category}: {selected.category}</span>
                </div>
              </div>
              <StatusPill status={selected.status} locale={locale} />
            </div>

            <div className="space-y-6 py-5">
              <section>
                <h3 className="font-semibold text-slate-950 dark:text-white">{locale === "zh-CN" ? "背景" : "Background"}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{selected.description}</p>
              </section>
              <section>
                <h3 className="font-semibold text-slate-950 dark:text-white">{locale === "zh-CN" ? "决策内容" : "Decision"}</h3>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {[selected.description, copy.pages.decisions.subtitle].map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 size-1.5 rounded-full bg-blue-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="font-semibold text-slate-950 dark:text-white">{locale === "zh-CN" ? "后续动作" : "Follow-up"}</h3>
                <div className="mt-3 space-y-2">
                  {(snapshot.tasks?.nextActions ?? snapshot.status?.nextActions ?? []).slice(0, 3).map((item, index) => (
                    <div key={item} className="grid gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm md:grid-cols-[1rem_minmax(0,1fr)_6rem_6rem] md:items-center dark:border-white/10">
                      <CheckSquare className={cn("size-4", index < 2 ? "text-blue-600" : "text-slate-400")} />
                      <span className="truncate text-slate-800 dark:text-slate-100">{item}</span>
                      <Person name={assignees[(index + 1) % assignees.length]} index={index + 1} />
                      <span className="text-slate-500">{dueDatesByLocale[locale][index]}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="border-t border-slate-200 pt-5 dark:border-white/10">
              <SectionHeader title={copy.rails.decisionMilestone} icon={<CheckCircle2 className="size-5" />} />
              <div className="grid gap-3 text-sm md:grid-cols-3">
                {[copy.fields.createdAt, copy.metrics.reviewing, copy.metrics.approved].map((label, index) => (
                  <div key={label} className="rounded-lg border border-slate-200 px-3 py-3 dark:border-white/10">
                    <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                      <CheckCircle2 className={cn("size-4", index < 2 ? "text-green-600" : "text-blue-600")} />
                      {label}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">{formatTimestamp(locale, selected.decidedAt ?? selected.createdAt)}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="py-12 text-center text-sm text-slate-500">{copy.empty.decisions}</div>
        )}
      </Surface>
    </div>
  );
}

function renderVersions(locale: SiteLocale, snapshot: ControlPlaneSnapshot) {
  const copy = detailCopy[locale];
  const versions = sortedVersions(snapshot);
  const current = versions[0] ?? null;
  const docs = snapshot.docs.pages.slice(0, 4);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(24rem,0.8fr)]">
      <div className="space-y-5">
        <Surface className="px-5 py-5">
          <SectionHeader title={copy.nav.versions} description={replaceCount(copy.fields.total, versions.length)} icon={<GitBranch className="size-5" />} />
          {versions.length ? (
            <div className="relative space-y-4 border-l border-blue-100 pl-6 dark:border-blue-400/20">
              {versions.map((version, index) => {
                const content = (
                  <div className={cn("relative rounded-xl border px-5 py-4", index === 0 ? "border-blue-300 bg-blue-50/40 dark:bg-blue-500/10" : "border-slate-200 dark:border-white/10")}>
                    <span className={cn("absolute -left-[2rem] top-6 size-3 rounded-full ring-4 ring-white dark:ring-neutral-950", index === 0 ? "bg-blue-600" : "bg-slate-300")} />
                    <div className="grid gap-4 md:grid-cols-[8rem_minmax(0,1fr)_max-content] md:items-start">
                      <div className="inline-flex h-24 items-center justify-center rounded-xl bg-slate-50 text-3xl font-bold text-blue-600 dark:bg-white/5">
                        {version.version}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{version.title}</h3>
                          <StatusPill status={version.status} locale={locale} />
                          {index === 0 ? <Badge className="border-green-100 bg-green-50 text-green-700">{copy.fields.current}</Badge> : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-5 text-sm text-slate-500">
                          <span>{copy.fields.releasedAt} {formatTimestamp(locale, version.recordedAt ?? version.createdAt)}</span>
                          <span>{copy.synthetic.owner}</span>
                        </div>
                        <ul className="mt-3 space-y-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                          {(version.highlights.length ? version.highlights : [version.summary]).slice(0, 3).map((item) => (
                            <li key={item} className="flex gap-2">
                              <span className="mt-2 size-1 rounded-full bg-slate-400" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        {[...version.decisionRefs, ...version.highlights].slice(0, 3).map((item) => (
                          <Badge key={item} className="border-slate-200 bg-white text-slate-500 dark:bg-neutral-950">
                            {item.length > 12 ? `${item.slice(0, 12)}...` : item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                );

                return version.docPath ? (
                  <Link key={version.id} href={docsPathToHref(locale, version.docPath)} className="block transition hover:opacity-90">
                    {content}
                  </Link>
                ) : (
                  <div key={version.id}>{content}</div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-white/10">
              {copy.empty.versions}
            </div>
          )}
        </Surface>

        <Surface className="px-5 py-5">
          <SectionHeader title={locale === "zh-CN" ? "版本时间线" : "Version Timeline"} icon={<CalendarClock className="size-5" />} />
          <div className="grid gap-4 text-sm md:grid-cols-3">
            {versions.slice(0, 3).map((version, index) => (
              <div key={version.id} className="relative rounded-lg border border-slate-200 px-4 py-4 text-center dark:border-white/10">
                <div className="mx-auto mb-2 size-3 rounded-full bg-blue-600" />
                <div className="font-semibold text-slate-900 dark:text-white">{version.version}</div>
                <div className="mt-1 text-slate-500">{formatTimestamp(locale, version.recordedAt ?? version.createdAt)}</div>
                {index < 2 ? <span className="absolute left-1/2 top-[1.35rem] hidden h-px w-full bg-blue-100 md:block" /> : null}
              </div>
            ))}
          </div>
        </Surface>
      </div>

      <div className="space-y-5">
        <Surface className="px-5 py-5">
          <SectionHeader title={copy.rails.releaseRhythm} icon={<Send className="size-5" />} actionHref={consoleSectionHref(locale, "versions")} actionLabel={copy.fields.viewAll} />
          <div className="space-y-4">
            {versions.slice(0, 3).map((version, index) => (
              <div key={version.id} className="grid grid-cols-[4rem_minmax(0,1fr)_4rem] items-center gap-3 text-sm">
                <span className="font-semibold text-slate-900 dark:text-white">{version.version}</span>
                <span className="h-2 rounded-full bg-slate-200">
                  <span className="block h-full rounded-full bg-blue-600" style={{ width: `${index === 0 ? 100 : 62 - index * 15}%` }} />
                </span>
                <span className="text-right text-slate-500">{formatTimestamp(locale, version.recordedAt ?? version.createdAt)}</span>
              </div>
            ))}
          </div>
        </Surface>

        <Surface className="px-5 py-5">
          <SectionHeader title={copy.rails.currentNotes} icon={<FileText className="size-5" />} />
          {current ? (
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-lg font-semibold text-slate-950 dark:text-white">{current.version}</div>
                <Badge className="border-green-100 bg-green-50 text-green-700">{copy.fields.current}</Badge>
              </div>
              <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">{current.summary}</p>
              <div className="mt-4 space-y-3">
                {(current.highlights.length ? current.highlights : [current.summary]).slice(0, 3).map((item, index) => (
                  <div key={item} className="flex gap-3 text-sm">
                    <span className={cn("mt-2 size-2 rounded-full", index === 0 ? "bg-green-600" : index === 1 ? "bg-blue-600" : "bg-orange-500")} />
                    <span className="leading-6 text-slate-600 dark:text-slate-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-500">{copy.empty.versions}</div>
          )}
        </Surface>

        <Surface className="px-5 py-5">
          <SectionHeader title={copy.fields.relatedDocs} icon={<FileText className="size-5" />} actionHref={docs.length ? docsPathToHref(locale, docs[0].path) : undefined} actionLabel={copy.fields.viewAll} />
          <div className="divide-y divide-slate-200 dark:divide-white/10">
            {docs.map((page) => (
              <Link key={page.path} href={docsPathToHref(locale, page.path)} className="flex items-center gap-3 py-3 text-sm hover:text-blue-600">
                <FileText className="size-4 shrink-0 text-blue-600" />
                <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">{page.title}</span>
                <ArrowRight className="size-4 shrink-0 text-slate-400" />
              </Link>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
}

function renderSection(section: ConsoleSection, locale: SiteLocale, snapshot: ControlPlaneSnapshot) {
  if (section === "plans") {
    return renderPlans(locale, snapshot);
  }

  if (section === "blockers") {
    return renderBlockers(locale, snapshot);
  }

  if (section === "changes") {
    return renderChanges(locale, snapshot);
  }

  if (section === "decisions") {
    return renderDecisions(locale, snapshot);
  }

  return renderVersions(locale, snapshot);
}

export function ConsoleDetailView({
  locale,
  snapshot,
  section
}: {
  locale: SiteLocale;
  snapshot: ControlPlaneSnapshot;
  section: ConsoleSection;
}) {
  const copy = detailCopy[locale];
  const page = copy.pages[section];
  const metrics = metricCards(section, locale, snapshot);

  return (
    <ConsoleSidebarLayout
      locale={locale}
      active={section}
      snapshot={snapshot}
      title={page.title}
      subtitle={page.subtitle}
      actions={(
        <>
          <ActionButton icon={section === "decisions" ? <Filter className="size-4" /> : <Download className="size-4" />}>
            {page.secondaryAction}
          </ActionButton>
          <ActionButton primary icon={section === "changes" ? <Download className="size-4" /> : <Plus className="size-4" />}>
            {page.primaryAction}
          </ActionButton>
        </>
      )}
    >
        <div className={cn("grid gap-5", metrics.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4")}>
          {metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              note={metric.note}
              icon={metric.icon}
              tone={metric.tone}
            />
          ))}
        </div>

        {renderSection(section, locale, snapshot)}
    </ConsoleSidebarLayout>
  );
}
