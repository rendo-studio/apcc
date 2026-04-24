import type { ReactNode } from "react";

import { Badge } from "../ui/badge";
import type { SiteLocale } from "../../lib/i18n";
import { cn } from "../../lib/utils";
import { docsHref, getSiteCopy } from "../../lib/site-copy";

export function docsPathToHref(locale: SiteLocale, docPath: string): string {
  return docsHref(locale, docPath);
}

export function RailPanel({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "console-surface overflow-hidden rounded-lg",
        className
      )}
    >
      {children}
    </aside>
  );
}

export function RailSection({
  label,
  children,
  className
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-b border-[color:var(--color-border)] px-4 py-4 last:border-b-0", className)}>
      <div className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--muted-foreground)]">{label}</div>
      {children}
    </section>
  );
}

export function MetricGrid({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <dl className={cn("grid grid-cols-2 gap-3", className)}>{children}</dl>;
}

export function Metric({
  label,
  value
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--muted-foreground)]">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-[color:var(--foreground)]">{value}</dd>
    </div>
  );
}

export function StatusBadge({
  status,
  locale
}: {
  status: string;
  locale: SiteLocale;
}) {
  const labels = getSiteCopy(locale).status;
  const normalized =
    status in labels
      ? labels[status as keyof typeof labels]
      : status.replaceAll("_", " ");
  const dotTone =
    status === "done"
      ? "bg-[#171717]"
      : status === "approved"
        ? "bg-[#171717]"
      : status === "in_progress"
        ? "bg-[#0a72ef]"
      : status === "blocked"
        ? "bg-[#b42318]"
        : status === "rejected"
          ? "bg-[#b42318]"
          : "bg-[#9a9a9a]";

  const badgeTone =
    status === "done"
      ? "border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]"
      : status === "approved"
        ? "border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]"
      : status === "in_progress"
        ? "border-[#d8e8ff] bg-[#f7faff] text-[#171717]"
      : status === "blocked"
        ? "border-[#f3d6d3] bg-[#fff8f7] text-[#171717]"
        : status === "rejected"
          ? "border-[#f3d6d3] bg-[#fff8f7] text-[#171717]"
          : "border-[color:var(--color-border)] bg-[color:var(--muted)] text-[color:var(--muted-foreground)]";

  return (
    <Badge className={cn("gap-2 px-2.5 py-1 text-[11px]", badgeTone)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dotTone)} />
      {normalized}
    </Badge>
  );
}

export function DataList({
  items,
  emptyLabel
}: {
  items: string[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <div className="text-sm leading-6 text-[color:var(--muted-foreground)]">{emptyLabel}</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item}
          className="console-item rounded-md px-3 py-2 text-sm leading-6 text-[color:var(--foreground)]"
        >
          {item}
        </div>
      ))}
    </div>
  );
}
