import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckSquare,
  Clock3,
  FileClock,
  FileText,
  GitBranch,
  History,
  LayoutDashboard,
  ShieldCheck,
  Target,
  UserCheck,
  Users,
  Wrench
} from "lucide-react";

import type { SiteLocale } from "../../lib/i18n";
import { consoleHref as getConsoleHref, consoleSectionHref } from "../../lib/console-routes";
import type { ControlPlaneSnapshot, RuntimeDocPage } from "../../lib/runtime-data";
import { formatSiteDate, getSiteCopy } from "../../lib/site-copy";
import { cn } from "../../lib/utils";
import { Progress } from "../ui/progress";
import { docsPathToHref } from "./docs-rail-shared";

const homeCopy = {
  "zh-CN": {
    eyebrow: "项目首页",
    status: "进行中",
    title: "APCC Docs Site",
    subtitle: "为维护者、贡献者与审阅者提供统一的文档与项目状态阅读界面",
    enterConsole: "进入控制台",
    readDocs: "阅读文档",
    goal: "最终目标",
    progress: "当前进展",
    currentPlan: "当前计划",
    completion: "完成度",
    blockers: "阻塞",
    next: "下一步",
    recentChanges: "最近变化",
    viewAll: "查看全部",
    recommended: "推荐入口",
    noRecent: "暂无最近变化",
    noBlockers: "0 项",
    newUser: "新用户",
    newUserDescription: "快速了解项目与开始使用",
    maintainer: "维护者",
    maintainerDescription: "管理内容、发布与配置站点",
    reviewer: "审阅者",
    reviewerDescription: "查看待审内容与提交反馈",
    planTasks: "计划与任务",
    planTasksDescription: "查看当前计划与任务列表",
    decisions: "决策记录",
    decisionsDescription: "查看架构与关键决策",
    versions: "版本记录",
    versionsDescription: "查看版本发布与里程碑",
    history: "变更历史",
    historyDescription: "查看所有变更记录",
    unknown: "未知",
    itemCount: (count: number) => `${count} 项`
  },
  en: {
    eyebrow: "Project Home",
    status: "In progress",
    title: "APCC Docs Site",
    subtitle: "A unified docs and project-state reading surface for maintainers, contributors, and reviewers",
    enterConsole: "Open Console",
    readDocs: "Read Docs",
    goal: "End Goal",
    progress: "Current Progress",
    currentPlan: "Current plan",
    completion: "Completion",
    blockers: "Blockers",
    next: "Next",
    recentChanges: "Recent Changes",
    viewAll: "View all",
    recommended: "Recommended",
    noRecent: "No recent changes",
    noBlockers: "0 items",
    newUser: "New user",
    newUserDescription: "Understand the project and start quickly",
    maintainer: "Maintainer",
    maintainerDescription: "Manage content, releases, and site setup",
    reviewer: "Reviewer",
    reviewerDescription: "Review pending work and give feedback",
    planTasks: "Plans & Tasks",
    planTasksDescription: "Inspect current plans and task lists",
    decisions: "Decisions",
    decisionsDescription: "Review architecture and key decisions",
    versions: "Versions",
    versionsDescription: "Review releases and milestones",
    history: "Change History",
    historyDescription: "See all recorded changes",
    unknown: "Unknown",
    itemCount: (count: number) => `${count} items`
  }
} satisfies Record<SiteLocale, Record<string, string | ((count: number) => string)>>;

function sortedRecentPages(pages: RuntimeDocPage[]): RuntimeDocPage[] {
  return [...pages]
    .sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""))
    .slice(0, 4);
}

function firstActivePlan(snapshot: ControlPlaneSnapshot): string {
  const plans = snapshot.plans?.items ?? [];
  return (
    plans.find((plan) => plan.status === "in_progress")?.name ??
    plans.find((plan) => plan.status !== "done")?.name ??
    snapshot.status?.phase ??
    "APCC"
  );
}

function filteredBlockers(snapshot: ControlPlaneSnapshot, locale: SiteLocale): string[] {
  const copy = getSiteCopy(locale);
  return (snapshot.tasks?.blockers ?? snapshot.status?.blockers ?? []).filter(
    (item) => ![copy.console.noExplicitBlocker, "No explicit blocker", "暂无明确 blocker"].includes(item)
  );
}

function formatChangeTime(locale: SiteLocale, value: string | null): string {
  if (!value) {
    return homeCopy[locale].unknown as string;
  }

  return formatSiteDate(locale, value, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function HomeCard({
  className,
  children
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-neutral-950",
        className
      )}
    >
      {children}
    </section>
  );
}

function SectionTitle({
  icon,
  children
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10">
        {icon}
      </span>
      <h2 className="text-base font-semibold text-slate-950 dark:text-white">{children}</h2>
    </div>
  );
}

function HeroIllustration() {
  return (
    <div className="relative hidden min-h-48 flex-1 items-center justify-center lg:flex" aria-hidden="true">
      <div className="absolute left-8 top-14 grid grid-cols-6 gap-3 opacity-60">
        {Array.from({ length: 24 }).map((_, index) => (
          <span key={index} className="size-1 rounded-full bg-blue-200" />
        ))}
      </div>
      <div className="absolute right-6 top-5 h-28 w-64 rounded-xl border border-blue-100 bg-blue-50/80 p-5 shadow-sm">
        <div className="h-3 w-full rounded-full bg-blue-200" />
        <div className="mt-7 space-y-3">
          <div className="h-2.5 w-28 rounded-full bg-blue-200" />
          <div className="h-2.5 w-36 rounded-full bg-blue-200" />
          <div className="h-2.5 w-32 rounded-full bg-blue-200" />
        </div>
      </div>
      <div className="absolute bottom-6 left-24 flex h-20 w-44 items-center gap-4 rounded-xl border border-blue-100 bg-blue-100/80 p-4 shadow-sm">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-white text-blue-500 shadow-sm">
          <CheckSquare className="size-5" />
        </span>
        <div className="space-y-3">
          <div className="h-2.5 w-20 rounded-full bg-blue-200" />
          <div className="h-2.5 w-14 rounded-full bg-blue-200" />
        </div>
      </div>
      <div className="absolute right-12 bottom-4 space-y-4">
        <div className="h-2.5 w-36 rounded-full bg-blue-100" />
        <div className="h-2.5 w-24 rounded-full bg-blue-100" />
      </div>
    </div>
  );
}

export function HomeOverviewView({
  locale,
  snapshot,
  docsHref
}: {
  locale: SiteLocale;
  snapshot: ControlPlaneSnapshot;
  docsHref: string;
}) {
  const copy = homeCopy[locale];
  const consoleUrl = getConsoleHref(locale);
  const progress = snapshot.progress?.percent ?? 0;
  const blockers = filteredBlockers(snapshot, locale);
  const recentPages = sortedRecentPages(snapshot.docs.changedPages);
  const nextAction = snapshot.tasks?.nextActions?.[0] ?? snapshot.status?.nextActions?.[0] ?? (copy.unknown as string);
  const planName = firstActivePlan(snapshot);
  const goalSummary = snapshot.endGoal?.summary ?? snapshot.project?.summary ?? "";

  const recommendationItems = [
    {
      title: copy.newUser as string,
      description: copy.newUserDescription as string,
      href: docsHref,
      icon: <Users className="size-5" />,
      tone: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300"
    },
    {
      title: copy.maintainer as string,
      description: copy.maintainerDescription as string,
      href: consoleUrl,
      icon: <Wrench className="size-5" />,
      tone: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
    },
    {
      title: copy.reviewer as string,
      description: copy.reviewerDescription as string,
      href: consoleSectionHref(locale, "decisions"),
      icon: <UserCheck className="size-5" />,
      tone: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300"
    }
  ];

  const quickEntries = [
    {
      title: copy.planTasks as string,
      description: copy.planTasksDescription as string,
      href: consoleSectionHref(locale, "plans"),
      icon: <CheckSquare className="size-6" />,
      tone: "bg-blue-50 text-blue-600"
    },
    {
      title: copy.decisions as string,
      description: copy.decisionsDescription as string,
      href: consoleSectionHref(locale, "decisions"),
      icon: <BookOpen className="size-6" />,
      tone: "bg-green-50 text-green-600"
    },
    {
      title: copy.versions as string,
      description: copy.versionsDescription as string,
      href: consoleSectionHref(locale, "versions"),
      icon: <GitBranch className="size-6" />,
      tone: "bg-violet-50 text-violet-600"
    },
    {
      title: copy.history as string,
      description: copy.historyDescription as string,
      href: consoleSectionHref(locale, "changes"),
      icon: <History className="size-6" />,
      tone: "bg-orange-50 text-orange-600"
    }
  ];

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-50/70 px-5 py-6 dark:bg-neutral-950">
      <div className="mx-auto max-w-[1360px] space-y-5">
        <HomeCard className="overflow-hidden bg-gradient-to-br from-blue-50/70 via-white to-white px-7 py-8 dark:from-blue-950/20 dark:via-neutral-950 dark:to-neutral-950">
          <div className="flex items-center gap-8">
            <div className="max-w-3xl">
              <div className="text-lg font-semibold text-slate-900 dark:text-white">{copy.eyebrow as string}</div>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <h1 className="text-4xl font-bold tracking-normal text-slate-950 dark:text-white md:text-5xl">
                  {copy.title as string}
                </h1>
                <span className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:border-green-400/20 dark:bg-green-500/10 dark:text-green-300">
                  <span className="size-2 rounded-full bg-green-500" />
                  {copy.status as string}
                </span>
              </div>
              <p className="mt-4 max-w-2xl text-lg leading-7 text-slate-600 dark:text-slate-300">{copy.subtitle as string}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={consoleUrl}
                  className="inline-flex h-12 items-center gap-2.5 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  <LayoutDashboard className="size-4.5" />
                  {copy.enterConsole as string}
                </Link>
                <Link
                  href={docsHref}
                  className="inline-flex h-12 items-center gap-2.5 rounded-lg border border-blue-600 bg-white px-6 text-sm font-semibold text-blue-600 shadow-sm transition hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-neutral-950 dark:hover:bg-blue-500/10"
                >
                  <BookOpen className="size-4.5" />
                  {copy.readDocs as string}
                </Link>
              </div>
            </div>
            <HeroIllustration />
          </div>
        </HomeCard>

        <HomeCard className="px-5 py-5">
          <div className="flex items-center gap-6">
            <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10">
              <Target className="size-6" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-950 dark:text-white">{copy.goal as string}</h2>
              <p className="mt-1.5 text-[15px] leading-6 text-slate-600 dark:text-slate-300">{goalSummary}</p>
            </div>
          </div>
        </HomeCard>

        <div className="grid gap-6 lg:grid-cols-3">
          <HomeCard className="px-5 py-5">
            <SectionTitle icon={<GitBranch className="size-5" />}>{copy.progress as string}</SectionTitle>
            <div className="divide-y divide-slate-200 text-sm dark:divide-white/10">
              <div className="flex items-center gap-3 py-3">
                <CheckSquare className="size-5 shrink-0 text-slate-500" />
                <span className="text-slate-600 dark:text-slate-300">{copy.currentPlan as string}:</span>
                <span className="min-w-0 truncate font-medium text-slate-950 dark:text-white">{planName}</span>
              </div>
              <div className="flex items-center gap-3 py-4">
                <Clock3 className="size-5 shrink-0 text-blue-600" />
                <span className="text-slate-600 dark:text-slate-300">{copy.completion as string}:</span>
                <span className="font-medium text-slate-950 dark:text-white">{progress}%</span>
                <Progress value={progress} className="ml-auto h-2 max-w-40 bg-slate-200" />
              </div>
              <div className="flex items-center gap-3 py-3">
                <ShieldCheck className="size-5 shrink-0 text-red-500" />
                <span className="text-slate-600 dark:text-slate-300">{copy.blockers as string}:</span>
                <span className={cn("font-medium", blockers.length ? "text-red-600" : "text-slate-950 dark:text-white")}>
                  {blockers.length ? (copy.itemCount as (count: number) => string)(blockers.length) : copy.noBlockers as string}
                </span>
              </div>
              <div className="flex items-center gap-3 py-3">
                <ArrowRight className="size-5 shrink-0 text-slate-500" />
                <span className="text-slate-600 dark:text-slate-300">{copy.next as string}:</span>
                <span className="min-w-0 truncate font-medium text-slate-950 dark:text-white">{nextAction}</span>
              </div>
            </div>
          </HomeCard>

          <HomeCard className="px-5 py-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <SectionTitle icon={<FileClock className="size-5" />}>{copy.recentChanges as string}</SectionTitle>
              <Link href={consoleSectionHref(locale, "changes")} className="mb-5 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-600">
                {copy.viewAll as string}
                <ChevronIcon />
              </Link>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-white/10">
              {recentPages.length ? (
                recentPages.map((page) => (
                  <Link
                    key={page.path}
                    href={docsPathToHref(locale, page.path)}
                    className="flex items-center gap-3 py-3 text-sm transition hover:text-blue-600"
                  >
                    <FileText className="size-5 shrink-0 text-slate-500" />
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">{page.title}</span>
                    <span className="shrink-0 text-slate-500">{formatChangeTime(locale, page.updatedAt)}</span>
                  </Link>
                ))
              ) : (
                <div className="py-8 text-sm text-slate-500">{copy.noRecent as string}</div>
              )}
            </div>
          </HomeCard>

          <HomeCard className="px-5 py-5">
            <SectionTitle icon={<Target className="size-5" />}>{copy.recommended as string}</SectionTitle>
            <div className="divide-y divide-slate-200 dark:divide-white/10">
              {recommendationItems.map((item) => (
                <Link key={item.title} href={item.href} className="group flex items-center gap-4 py-4">
                  <span className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-full", item.tone)}>
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-950 dark:text-white">{item.title}</span>
                    <span className="mt-1 block text-sm text-slate-500">{item.description}</span>
                  </span>
                  <ArrowRight className="size-5 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600" />
                </Link>
              ))}
            </div>
          </HomeCard>
        </div>

        <HomeCard className="grid overflow-hidden sm:grid-cols-2 lg:grid-cols-4">
          {quickEntries.map((entry) => (
            <Link
              key={entry.title}
              href={entry.href}
              className="group flex items-center gap-4 border-b border-slate-200 px-5 py-4 transition hover:bg-slate-50 sm:border-r lg:border-b-0 dark:border-white/10 dark:hover:bg-white/5"
            >
              <span className={cn("inline-flex size-12 shrink-0 items-center justify-center rounded-xl", entry.tone)}>
                {entry.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-950 dark:text-white">{entry.title}</span>
                <span className="mt-1 block truncate text-sm text-slate-500">{entry.description}</span>
              </span>
              <ArrowRight className="size-5 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600" />
            </Link>
          ))}
        </HomeCard>
      </div>
    </main>
  );
}

function ChevronIcon() {
  return <ArrowRight className="size-4" aria-hidden="true" />;
}
