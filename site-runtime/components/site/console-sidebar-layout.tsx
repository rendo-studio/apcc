import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  Circle,
  FileClock,
  FileText,
  GitBranch,
  Gauge,
  Layers3,
  ListChecks,
  ShieldCheck
} from "lucide-react";

import {
  consoleHref,
  consoleSectionHref,
  type ConsoleSection
} from "../../lib/console-routes";
import type { SiteLocale } from "../../lib/i18n";
import type { ControlPlaneSnapshot } from "../../lib/runtime-data";
import { getSiteCopy } from "../../lib/site-copy";
import { cn } from "../../lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger
} from "../ui/sidebar";

type ConsoleNavKey = "overview" | ConsoleSection;

const sidebarCopy = {
  "zh-CN": {
    title: "控制台",
    subtitle: "控制平面",
    status: "状态",
    modules: "模块",
    overview: "总览",
    delivery: "交付",
    records: "记录",
    plans: "计划与任务",
    blockers: "阻塞项",
    changes: "变更历史",
    decisions: "决策记录",
    versions: "版本记录",
    progress: "整体进度",
    phase: "阶段",
    noBlockers: "无阻塞"
  },
  en: {
    title: "Console",
    subtitle: "Control plane",
    status: "Status",
    modules: "Modules",
    overview: "Overview",
    delivery: "Delivery",
    records: "Records",
    plans: "Plans & Tasks",
    blockers: "Blockers",
    changes: "Change History",
    decisions: "Decisions",
    versions: "Versions",
    progress: "Progress",
    phase: "Phase",
    noBlockers: "No blockers"
  }
} satisfies Record<SiteLocale, Record<string, string>>;

function activeBlockers(snapshot: ControlPlaneSnapshot, locale: SiteLocale): string[] {
  const copy = getSiteCopy(locale);
  return (snapshot.tasks?.blockers ?? snapshot.status?.blockers ?? []).filter(
    (item) => ![copy.console.noExplicitBlocker, "No explicit blocker", "暂无明确 blocker"].includes(item)
  );
}

function taskCounts(snapshot: ControlPlaneSnapshot) {
  const tasks = snapshot.tasks?.items ?? [];
  const counted = tasks.filter((task) => task.countedForProgress);

  return {
    total: counted.length,
    done: counted.filter((task) => task.status === "done").length,
    active: counted.filter((task) => task.status === "in_progress").length
  };
}

function NavBadge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "danger" | "success" }) {
  return (
    <SidebarMenuBadge
      className={cn(
        tone === "danger" && "text-red-600",
        tone === "success" && "text-green-700",
        tone === "default" && "text-sidebar-foreground/60"
      )}
    >
      {children}
    </SidebarMenuBadge>
  );
}

function ConsoleLink({
  href,
  active,
  icon,
  label,
  badge,
  badgeTone = "default"
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  label: string;
  badge?: ReactNode;
  badgeTone?: "default" | "danger" | "success";
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active}>
        <Link href={href}>
          {icon}
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
      {badge !== undefined ? <NavBadge tone={badgeTone}>{badge}</NavBadge> : null}
    </SidebarMenuItem>
  );
}

function ConsoleSubLink({
  href,
  active,
  icon,
  label,
  badge,
  badgeTone = "default"
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  label: string;
  badge?: ReactNode;
  badgeTone?: "default" | "danger" | "success";
}) {
  return (
    <SidebarMenuSubItem>
      <div className="relative">
        <SidebarMenuSubButton asChild isActive={active} className={badge !== undefined ? "pr-8" : undefined}>
          <Link href={href}>
            {icon}
            <span>{label}</span>
          </Link>
        </SidebarMenuSubButton>
        {badge !== undefined ? <NavBadge tone={badgeTone}>{badge}</NavBadge> : null}
      </div>
    </SidebarMenuSubItem>
  );
}

function ConsoleSidebar({
  locale,
  active,
  snapshot
}: {
  locale: SiteLocale;
  active: ConsoleNavKey;
  snapshot: ControlPlaneSnapshot;
}) {
  const copy = sidebarCopy[locale];
  const counts = taskCounts(snapshot);
  const blockers = activeBlockers(snapshot, locale);
  const progress = snapshot.progress?.percent ?? 0;
  const changedDocs = snapshot.docs.changedPages.length;
  const decisions = snapshot.decisions?.items.length ?? 0;
  const versions = snapshot.versions?.items.length ?? 0;

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-3 pr-8 md:pr-0">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <Gauge className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-sidebar-foreground">{copy.title}</div>
            <div className="truncate text-xs text-sidebar-foreground/55">{copy.subtitle}</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{copy.status}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <ConsoleLink
                href={consoleHref(locale)}
                active={active === "overview"}
                icon={<BarChart3 className="size-4" />}
                label={copy.overview}
                badge={`${progress}%`}
                badgeTone={progress >= 100 ? "success" : "default"}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>{copy.modules}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              <SidebarMenuItem>
                <SidebarMenuButton type="button" className="text-sidebar-foreground/75">
                  <ListChecks className="size-4" />
                  <span>{copy.delivery}</span>
                </SidebarMenuButton>
                <SidebarMenuSub>
                  <ConsoleSubLink
                    href={consoleSectionHref(locale, "plans")}
                    active={active === "plans"}
                    icon={<Layers3 className="size-4" />}
                    label={copy.plans}
                    badge={counts.active > 0 ? counts.active : counts.total}
                    badgeTone={counts.active > 0 ? "default" : "success"}
                  />
                  <ConsoleSubLink
                    href={consoleSectionHref(locale, "blockers")}
                    active={active === "blockers"}
                    icon={<AlertTriangle className="size-4" />}
                    label={copy.blockers}
                    badge={blockers.length}
                    badgeTone={blockers.length ? "danger" : "success"}
                  />
                </SidebarMenuSub>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton type="button" className="text-sidebar-foreground/75">
                  <ShieldCheck className="size-4" />
                  <span>{copy.records}</span>
                </SidebarMenuButton>
                <SidebarMenuSub>
                  <ConsoleSubLink
                    href={consoleSectionHref(locale, "changes")}
                    active={active === "changes"}
                    icon={<FileClock className="size-4" />}
                    label={copy.changes}
                    badge={changedDocs}
                  />
                  <ConsoleSubLink
                    href={consoleSectionHref(locale, "decisions")}
                    active={active === "decisions"}
                    icon={<FileText className="size-4" />}
                    label={copy.decisions}
                    badge={decisions}
                  />
                  <ConsoleSubLink
                    href={consoleSectionHref(locale, "versions")}
                    active={active === "versions"}
                    icon={<GitBranch className="size-4" />}
                    label={copy.versions}
                    badge={versions}
                  />
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="rounded-xl border border-sidebar-border bg-white/70 px-3 py-3 text-xs leading-5 text-sidebar-foreground/65 dark:bg-white/5">
          <div className="flex items-center justify-between gap-3">
            <span>{copy.progress}</span>
            <span className="font-semibold text-sidebar-foreground">{counts.done}/{counts.total}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
            <span className="block h-full rounded-full bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
          </div>
          <div className="mt-2 flex min-w-0 items-center gap-2">
            <Circle className="size-2 fill-green-600 text-green-600" />
            <span className="truncate">{blockers.length ? `${blockers.length} ${copy.blockers}` : copy.noBlockers}</span>
          </div>
          <div className="mt-1 truncate">{copy.phase}: {snapshot.status?.phase ?? "-"}</div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function ConsoleSidebarLayout({
  locale,
  active,
  snapshot,
  title,
  subtitle,
  badge,
  actions,
  children
}: {
  locale: SiteLocale;
  active: ConsoleNavKey;
  snapshot: ControlPlaneSnapshot;
  title: string;
  subtitle: string;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SidebarProvider>
      <ConsoleSidebar locale={locale} active={active} snapshot={snapshot} />
      <SidebarInset className="min-h-[calc(100vh-4rem)] px-5 py-6 md:px-6">
        <div className="mx-auto max-w-[1360px] space-y-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <SidebarTrigger className="mt-0.5 md:hidden" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-normal text-slate-950 dark:text-white md:text-3xl">{title}</h1>
                  {badge}
                </div>
                <p className="mt-2 text-[15px] leading-6 text-slate-500">{subtitle}</p>
              </div>
            </div>
            {actions ? <div className="flex flex-wrap gap-3 md:justify-end">{actions}</div> : null}
          </div>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
