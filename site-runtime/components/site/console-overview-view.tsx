import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Circle,
  FileClock,
  FileText,
  GitBranch,
  Gauge,
  Layers3,
  ListChecks,
  ShieldCheck,
  Target,
  Zap
} from "lucide-react";

import { consoleSectionHref } from "../../lib/console-routes";
import type { SiteLocale } from "../../lib/i18n";
import type { ControlPlaneSnapshot } from "../../lib/runtime-data";
import { formatSiteDate, getSiteCopy } from "../../lib/site-copy";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { ConsoleSidebarLayout } from "./console-sidebar-layout";
import { docsPathToHref } from "./docs-rail-shared";

type RuntimePlan = NonNullable<ControlPlaneSnapshot["plans"]>["items"][number];
type RuntimeTask = NonNullable<ControlPlaneSnapshot["tasks"]>["items"][number];
type RuntimeDecision = NonNullable<ControlPlaneSnapshot["decisions"]>["items"][number];
type RuntimeVersion = NonNullable<ControlPlaneSnapshot["versions"]>["items"][number];

const overviewCopy = {
  "zh-CN": {
    title: "控制台",
    subtitle: "一眼看清项目健康度、当前焦点与需要关注的变化",
    statusUpdated: "状态已更新",
    allChanges: "查看全部变更",
    health: "项目健康度",
    healthStable: "项目状态稳定",
    healthAttention: "需要关注",
    completion: "完成率",
    phase: "当前阶段",
    noBlockers: "无活跃阻塞",
    blocked: "{count} 项阻塞",
    executionFocus: "执行焦点",
    noActivePlan: "暂无进行中的计划",
    nextActions: "下一步",
    noActions: "暂无下一步动作",
    taskDistribution: "任务分布",
    activeWork: "进行中与最近计划",
    riskGovernance: "风险与治理",
    recentSignals: "最近信号",
    plans: "计划",
    tasks: "任务",
    docs: "文档",
    decisions: "决策",
    versions: "版本",
    blockers: "阻塞",
    changedDocs: "变更文档",
    pendingDecisions: "待确认决策",
    draftVersions: "草稿版本",
    inProgress: "进行中",
    completed: "已完成",
    pending: "待处理",
    done: "已完成",
    view: "查看",
    viewAll: "查看全部",
    currentVersion: "当前版本",
    noChanges: "暂无最近变化",
    noDecisions: "暂无决策记录",
    noVersions: "暂无版本记录",
    noRisks: "当前没有需要人工介入的风险",
    updatedAt: "更新时间",
    taskUnit: "{done}/{total}",
    signalChanges: "最近变化",
    signalDecisions: "决策记录",
    signalVersions: "版本记录"
  },
  en: {
    title: "Console",
    subtitle: "See project health, current focus, and important changes at a glance",
    statusUpdated: "Status updated",
    allChanges: "View all changes",
    health: "Project Health",
    healthStable: "Project state is stable",
    healthAttention: "Needs attention",
    completion: "Completion",
    phase: "Current phase",
    noBlockers: "No active blockers",
    blocked: "{count} blockers",
    executionFocus: "Execution Focus",
    noActivePlan: "No active plan",
    nextActions: "Next",
    noActions: "No next actions",
    taskDistribution: "Task Distribution",
    activeWork: "Active & Recent Plans",
    riskGovernance: "Risk & Governance",
    recentSignals: "Recent Signals",
    plans: "Plans",
    tasks: "Tasks",
    docs: "Docs",
    decisions: "Decisions",
    versions: "Versions",
    blockers: "Blockers",
    changedDocs: "Changed docs",
    pendingDecisions: "Pending decisions",
    draftVersions: "Draft versions",
    inProgress: "In progress",
    completed: "Completed",
    pending: "Pending",
    done: "Done",
    view: "View",
    viewAll: "View all",
    currentVersion: "Current",
    noChanges: "No recent changes",
    noDecisions: "No decisions",
    noVersions: "No versions",
    noRisks: "No risks need intervention",
    updatedAt: "Updated",
    taskUnit: "{done}/{total}",
    signalChanges: "Recent Changes",
    signalDecisions: "Decisions",
    signalVersions: "Versions"
  }
} satisfies Record<SiteLocale, Record<string, string>>;

const taskColors = {
  done: "#2563eb",
  in_progress: "#16a34a",
  blocked: "#dc2626",
  pending: "#cbd5e1"
} satisfies Record<RuntimeTask["status"], string>;

function formatText(template: string, replacements: Record<string, string | number>): string {
  return Object.entries(replacements).reduce(
    (value, [key, replacement]) => value.replace(`{${key}}`, String(replacement)),
    template
  );
}

function formatTimestamp(locale: SiteLocale, value: string | null | undefined): string {
  if (!value) {
    return locale === "zh-CN" ? "未知" : "Unknown";
  }

  return formatSiteDate(locale, value, {
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

function StatusPill({ status, locale }: { status: string; locale: SiteLocale }) {
  const labels = getSiteCopy(locale).status;
  const label = status in labels ? labels[status as keyof typeof labels] : status.replaceAll("_", " ");

  return (
    <Badge className={cn("gap-2 whitespace-nowrap border px-2 py-1", statusTone(status))}>
      <span className={cn("size-1.5 rounded-full", statusDot(status))} />
      {label}
    </Badge>
  );
}

function Panel({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-neutral-950",
        className
      )}
    >
      {children}
    </section>
  );
}

function PanelHeader({
  title,
  icon,
  actionHref,
  actionLabel
}: {
  title: string;
  icon: ReactNode;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10">
          {icon}
        </span>
        <h2 className="truncate text-base font-semibold text-slate-950 dark:text-white">{title}</h2>
      </div>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="inline-flex shrink-0 items-center gap-1 text-sm text-slate-500 transition hover:text-blue-600">
          {actionLabel}
          <ArrowRight className="size-4" />
        </Link>
      ) : null}
    </div>
  );
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

function getPlanProgress(plan: RuntimePlan, tasks: RuntimeTask[]): { total: number; done: number; percent: number } {
  const scoped = tasks.filter((task) => task.planRef === plan.id && task.countedForProgress);
  const done = scoped.filter((task) => task.status === "done").length;

  return {
    total: scoped.length,
    done,
    percent: scoped.length > 0 ? Math.round((done / scoped.length) * 100) : plan.status === "done" ? 100 : 0
  };
}

function filteredBlockers(snapshot: ControlPlaneSnapshot, locale: SiteLocale): string[] {
  const copy = getSiteCopy(locale);
  return (snapshot.tasks?.blockers ?? snapshot.status?.blockers ?? []).filter(
    (item) => ![copy.console.noExplicitBlocker, "No explicit blocker", "暂无明确 blocker"].includes(item)
  );
}

function sortedPlans(snapshot: ControlPlaneSnapshot): RuntimePlan[] {
  return [...(snapshot.plans?.items ?? [])].sort((left, right) => planPriority(left) - planPriority(right));
}

function activePlans(snapshot: ControlPlaneSnapshot): RuntimePlan[] {
  const plans = sortedPlans(snapshot);
  const active = plans.filter((plan) => plan.status !== "done");
  return active.length ? active.slice(0, 4) : [...(snapshot.plans?.items ?? [])].reverse().slice(0, 4);
}

function focusPlan(snapshot: ControlPlaneSnapshot): RuntimePlan | null {
  return sortedPlans(snapshot).find((plan) => plan.status !== "done") ?? null;
}

function compactTasks(tasks: RuntimeTask[], planId: string): RuntimeTask[] {
  return tasks.filter((task) => task.planRef === planId && task.countedForProgress).slice(0, 3);
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

function taskCounts(tasks: RuntimeTask[]) {
  const counted = tasks.filter((task) => task.countedForProgress);

  return {
    total: counted.length,
    done: counted.filter((task) => task.status === "done").length,
    inProgress: counted.filter((task) => task.status === "in_progress").length,
    blocked: counted.filter((task) => task.status === "blocked").length,
    pending: counted.filter((task) => task.status === "pending").length
  };
}

function DonutChart({
  value,
  label,
  children
}: {
  value: number;
  label: string;
  children?: ReactNode;
}) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className="relative grid place-items-center">
      <div
        className="size-36 rounded-full shadow-inner"
        style={{
          background: `conic-gradient(#2563eb 0 ${safeValue}%, #e2e8f0 ${safeValue}% 100%)`
        }}
      />
      <div className="absolute grid size-24 place-items-center rounded-full bg-white text-center shadow-sm dark:bg-neutral-950">
        <div>
          <div className="text-3xl font-bold leading-none text-slate-950 dark:text-white">{safeValue}%</div>
          <div className="mt-1 text-[11px] font-medium text-slate-500">{label}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function TaskDistributionChart({
  counts,
  locale
}: {
  counts: ReturnType<typeof taskCounts>;
  locale: SiteLocale;
}) {
  const copy = overviewCopy[locale];
  const total = Math.max(counts.total, 1);
  const done = (counts.done / total) * 100;
  const inProgress = done + (counts.inProgress / total) * 100;
  const blocked = inProgress + (counts.blocked / total) * 100;

  const background =
    counts.total === 0
      ? "#e2e8f0"
      : `conic-gradient(${taskColors.done} 0 ${done}%, ${taskColors.in_progress} ${done}% ${inProgress}%, ${taskColors.blocked} ${inProgress}% ${blocked}%, ${taskColors.pending} ${blocked}% 100%)`;
  const rows = [
    { label: copy.completed, value: counts.done, color: "bg-blue-600" },
    { label: copy.inProgress, value: counts.inProgress, color: "bg-green-600" },
    { label: copy.blockers, value: counts.blocked, color: "bg-red-600" },
    { label: copy.pending, value: counts.pending, color: "bg-slate-300" }
  ];

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
      <div className="relative mx-auto grid place-items-center">
        <div className="size-32 rounded-full shadow-inner" style={{ background }} />
        <div className="absolute grid size-20 place-items-center rounded-full bg-white text-center shadow-sm dark:bg-neutral-950">
          <div>
            <div className="text-2xl font-bold text-slate-950 dark:text-white">{counts.total}</div>
            <div className="text-[11px] text-slate-500">{copy.tasks}</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg border border-slate-200 px-3 py-3 dark:border-white/10">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className={cn("size-2 rounded-full", row.color)} />
              {row.label}
            </div>
            <div className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  icon,
  tone,
  href
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-slate-200 bg-white px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50/50 dark:border-white/10 dark:bg-neutral-950 dark:hover:bg-blue-500/10"
    >
      <div className="flex items-center justify-between gap-3">
        <span className={cn("inline-flex size-8 items-center justify-center rounded-lg", tone)}>{icon}</span>
        <ArrowRight className="size-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-950 dark:text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </Link>
  );
}

function CompactRow({
  href,
  title,
  meta,
  right,
  icon
}: {
  href?: string;
  title: string;
  meta: string;
  right?: ReactNode;
  icon: ReactNode;
}) {
  const content = (
    <>
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">{meta}</span>
      </span>
      {right ? <span className="shrink-0">{right}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-slate-50 dark:hover:bg-white/5">
        {content}
      </Link>
    );
  }

  return <div className="flex items-center gap-3 rounded-lg px-2 py-2">{content}</div>;
}

function EmptyRow({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-white/10">
      {children}
    </div>
  );
}

export function ConsoleOverviewView({
  locale,
  snapshot
}: {
  locale: SiteLocale;
  snapshot: ControlPlaneSnapshot;
}) {
  const copy = overviewCopy[locale];
  const tasks = snapshot.tasks?.items ?? [];
  const counts = taskCounts(tasks);
  const plans = activePlans(snapshot);
  const blockers = filteredBlockers(snapshot, locale);
  const changes = [...snapshot.docs.changedPages]
    .sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""))
    .slice(0, 3);
  const decisions = sortedDecisions(snapshot).slice(0, 3);
  const versions = sortedVersions(snapshot).slice(0, 3);
  const nextActions = (snapshot.tasks?.nextActions ?? snapshot.status?.nextActions ?? []).slice(0, 3);
  const completion = counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : snapshot.progress?.percent ?? 0;
  const healthLabel = blockers.length === 0 ? copy.healthStable : copy.healthAttention;
  const healthTone = blockers.length === 0 ? "text-green-700" : "text-red-600";
  const currentPlan = focusPlan(snapshot);
  const currentPlanProgress = currentPlan ? getPlanProgress(currentPlan, tasks) : null;
  const pendingDecisions = (snapshot.decisions?.items ?? []).filter((decision) => decision.status === "pending").length;
  const draftVersions = (snapshot.versions?.items ?? []).filter((version) => version.status === "draft").length;

  return (
    <ConsoleSidebarLayout
      locale={locale}
      active="overview"
      snapshot={snapshot}
      title={copy.title}
      subtitle={copy.subtitle}
      badge={(
        <Badge className="border-blue-100 bg-blue-50 text-[11px] text-blue-600 dark:border-blue-400/20 dark:bg-blue-500/10">
          <span className="size-1.5 rounded-full bg-blue-600" />
          {copy.statusUpdated}
        </Badge>
      )}
      actions={(
        <Link
          href={consoleSectionHref(locale, "changes")}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-600 bg-white px-4 text-sm font-semibold text-blue-600 shadow-sm transition hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-neutral-950 dark:hover:bg-blue-500/10"
        >
          {copy.allChanges}
          <ArrowRight className="size-4" />
        </Link>
      )}
    >
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(22rem,0.8fr)]">
          <Panel className="px-5 py-5">
            <PanelHeader title={copy.health} icon={<Gauge className="size-5" />} />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-[9rem_minmax(0,1fr)] md:items-center">
              <DonutChart value={completion} label={copy.completion} />
              <div className="min-w-0 space-y-4">
                <div>
                  <div className={cn("text-lg font-semibold", healthTone)}>{healthLabel}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {blockers.length
                      ? formatText(copy.blocked, { count: blockers.length })
                      : copy.noBlockers}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
                  <div className="min-w-0 rounded-lg border border-slate-200 px-2 py-3 dark:border-white/10">
                    <div className="text-xl font-bold text-slate-950 dark:text-white">{snapshot.plans?.items.length ?? 0}</div>
                    <div className="text-[11px] text-slate-500">{copy.plans}</div>
                  </div>
                  <div className="min-w-0 rounded-lg border border-slate-200 px-2 py-3 dark:border-white/10">
                    <div className="text-xl font-bold text-slate-950 dark:text-white">{counts.total}</div>
                    <div className="text-[11px] text-slate-500">{copy.tasks}</div>
                  </div>
                  <div className="min-w-0 rounded-lg border border-slate-200 px-2 py-3 dark:border-white/10">
                    <div className="text-xl font-bold text-slate-950 dark:text-white">{snapshot.docs.changedPages.length}</div>
                    <div className="text-[11px] text-slate-500">{copy.docs}</div>
                  </div>
                </div>
                <div className="grid min-w-0 gap-1 text-xs text-slate-500 sm:flex sm:flex-wrap sm:gap-x-4">
                  <span className="min-w-0 truncate">{copy.phase}: {snapshot.status?.phase ?? "-"}</span>
                  <span className="min-w-0 truncate">{copy.updatedAt}: {formatTimestamp(locale, snapshot.generatedAt)}</span>
                </div>
              </div>
            </div>
          </Panel>

          <Panel className="px-5 py-5">
            <PanelHeader title={copy.executionFocus} icon={<Target className="size-5" />} actionHref={consoleSectionHref(locale, "plans")} actionLabel={copy.view} />
            {currentPlan && currentPlanProgress ? (
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-4 dark:border-blue-400/20 dark:bg-blue-500/10">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-slate-950 dark:text-white">{currentPlan.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {currentPlan.summary ?? copy.noActivePlan}
                    </p>
                  </div>
                  <StatusPill status={currentPlan.status} locale={locale} />
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Progress value={currentPlanProgress.percent} className="h-2 bg-slate-200" />
                  <span className="w-10 text-right text-sm font-medium text-slate-700 dark:text-slate-200">
                    {currentPlanProgress.percent}%
                  </span>
                  <span className="text-sm text-slate-500">
                    {formatText(copy.taskUnit, { done: currentPlanProgress.done, total: currentPlanProgress.total })}
                  </span>
                </div>
              </div>
            ) : (
              <EmptyRow>{copy.noActivePlan}</EmptyRow>
            )}

            <div className="mt-4">
              <div className="mb-2 text-xs font-medium uppercase text-slate-500">{copy.nextActions}</div>
              <div className="space-y-1">
                {nextActions.length ? (
                  nextActions.map((action, index) => (
                    <CompactRow
                      key={action}
                      title={action}
                      meta={index === 0 ? copy.executionFocus : copy.nextActions}
                      icon={index === 0 ? <Zap className="size-4" /> : <Circle className="size-4" />}
                    />
                  ))
                ) : (
                  <div className="rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-500 dark:border-white/10">{copy.noActions}</div>
                )}
              </div>
            </div>
          </Panel>

          <Panel className="px-5 py-5">
            <PanelHeader title={copy.taskDistribution} icon={<BarChart3 className="size-5" />} actionHref={consoleSectionHref(locale, "plans")} actionLabel={copy.view} />
            <TaskDistributionChart counts={counts} locale={locale} />
          </Panel>
        </div>

        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(24rem,0.9fr)]">
          <Panel className="px-5 py-5">
            <PanelHeader title={copy.activeWork} icon={<ListChecks className="size-5" />} actionHref={consoleSectionHref(locale, "plans")} actionLabel={copy.viewAll} />
            {plans.length ? (
              <div className="space-y-3">
                {plans.map((plan) => {
                  const progress = getPlanProgress(plan, tasks);
                  const scopedTasks = compactTasks(tasks, plan.id);

                  return (
                    <div key={plan.id} className="rounded-xl border border-slate-200 px-4 py-3 dark:border-white/10">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-950 dark:text-white">{plan.name}</div>
                          {plan.summary ? <div className="mt-1 line-clamp-1 text-xs text-slate-500">{plan.summary}</div> : null}
                        </div>
                        <StatusPill status={plan.status} locale={locale} />
                        <span className="text-sm text-slate-500">{progress.percent}%</span>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <Progress value={progress.percent} className="h-2 bg-slate-200" />
                        <span className="text-xs text-slate-500">
                          {formatText(copy.taskUnit, { done: progress.done, total: progress.total })}
                        </span>
                      </div>
                      {scopedTasks.length ? (
                        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                          {scopedTasks.map((task) => (
                            <div key={task.id} className="min-w-0 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-white/5">
                              <div className="truncate font-medium text-slate-800 dark:text-slate-100">{task.name}</div>
                              <div className="mt-1 flex items-center gap-2 text-slate-500">
                                <span className={cn("size-1.5 rounded-full", statusDot(task.status))} />
                                <span>{getSiteCopy(locale).status[task.status]}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyRow>{copy.noActivePlan}</EmptyRow>
            )}
          </Panel>

          <Panel className="px-5 py-5">
            <PanelHeader title={copy.riskGovernance} icon={<ShieldCheck className="size-5" />} actionHref={consoleSectionHref(locale, "blockers")} actionLabel={copy.viewAll} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MetricTile
                label={copy.blockers}
                value={blockers.length}
                icon={<AlertTriangle className="size-4" />}
                tone={blockers.length ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}
                href={consoleSectionHref(locale, "blockers")}
              />
              <MetricTile
                label={copy.pendingDecisions}
                value={pendingDecisions}
                icon={<FileText className="size-4" />}
                tone="bg-blue-50 text-blue-600"
                href={consoleSectionHref(locale, "decisions")}
              />
              <MetricTile
                label={copy.draftVersions}
                value={draftVersions}
                icon={<GitBranch className="size-4" />}
                tone="bg-orange-50 text-orange-700"
                href={consoleSectionHref(locale, "versions")}
              />
              <MetricTile
                label={copy.changedDocs}
                value={snapshot.docs.changedPages.length}
                icon={<FileClock className="size-4" />}
                tone="bg-violet-50 text-violet-700"
                href={consoleSectionHref(locale, "changes")}
              />
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-500 dark:border-white/10">
              {blockers.length ? blockers.slice(0, 2).join(" / ") : copy.noRisks}
            </div>
          </Panel>
        </div>

        <Panel className="px-5 py-5">
          <PanelHeader title={copy.recentSignals} icon={<Activity className="size-5" />} />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div>
              <PanelHeader title={copy.signalChanges} icon={<CalendarClock className="size-4" />} actionHref={consoleSectionHref(locale, "changes")} actionLabel={copy.viewAll} />
              <div className="space-y-1">
                {changes.length ? (
                  changes.map((page) => (
                    <CompactRow
                      key={page.path}
                      href={docsPathToHref(locale, page.path)}
                      title={page.title}
                      meta={formatTimestamp(locale, page.updatedAt)}
                      icon={<FileClock className="size-4" />}
                    />
                  ))
                ) : (
                  <EmptyRow>{copy.noChanges}</EmptyRow>
                )}
              </div>
            </div>

            <div>
              <PanelHeader title={copy.signalDecisions} icon={<FileText className="size-4" />} actionHref={consoleSectionHref(locale, "decisions")} actionLabel={copy.viewAll} />
              <div className="space-y-1">
                {decisions.length ? (
                  decisions.map((decision) => (
                    <CompactRow
                      key={decision.id}
                      href={decision.docPath ? docsPathToHref(locale, decision.docPath) : consoleSectionHref(locale, "decisions")}
                      title={decision.name}
                      meta={formatTimestamp(locale, decision.decidedAt ?? decision.createdAt)}
                      right={<StatusPill status={decision.status} locale={locale} />}
                      icon={<CheckCircle2 className="size-4" />}
                    />
                  ))
                ) : (
                  <EmptyRow>{copy.noDecisions}</EmptyRow>
                )}
              </div>
            </div>

            <div>
              <PanelHeader title={copy.signalVersions} icon={<GitBranch className="size-4" />} actionHref={consoleSectionHref(locale, "versions")} actionLabel={copy.viewAll} />
              <div className="space-y-1">
                {versions.length ? (
                  versions.map((version, index) => (
                    <CompactRow
                      key={version.id}
                      href={version.docPath ? docsPathToHref(locale, version.docPath) : consoleSectionHref(locale, "versions")}
                      title={`${version.version} ${version.title}`}
                      meta={formatTimestamp(locale, version.recordedAt ?? version.createdAt)}
                      right={index === 0 ? <Badge className="border-blue-100 bg-blue-50 text-blue-600">{copy.currentVersion}</Badge> : null}
                      icon={<Layers3 className="size-4" />}
                    />
                  ))
                ) : (
                  <EmptyRow>{copy.noVersions}</EmptyRow>
                )}
              </div>
            </div>
          </div>
        </Panel>
    </ConsoleSidebarLayout>
  );
}
