"use client";

import Link from "next/link";
import { useMemo } from "react";

import type { SiteLocale } from "../../lib/i18n";
import { formatSiteDate, getSiteCopy } from "../../lib/site-copy";
import type { RuntimeDocPage } from "../../lib/runtime-data";
import { useDocsLive } from "./docs-live-provider";
import { RailPanel, RailSection, docsPathToHref } from "./docs-rail-shared";

function formatChangedAt(locale: SiteLocale, value: string | null, fallback: string): string {
  if (!value) {
    return fallback;
  }

  return formatSiteDate(locale, value, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function sortByUpdatedAtDesc(pages: RuntimeDocPage[]): RuntimeDocPage[] {
  return [...pages].sort((left, right) => {
    const leftValue = left.updatedAt ?? "";
    const rightValue = right.updatedAt ?? "";
    return rightValue.localeCompare(leftValue);
  });
}

function DocChangeList({
  locale,
  pages,
  emptyLabel
}: {
  locale: SiteLocale;
  pages: RuntimeDocPage[];
  emptyLabel: string;
}) {
  const copy = getSiteCopy(locale);

  if (pages.length === 0) {
    return <div className="text-sm leading-6 text-[color:var(--muted-foreground)]">{emptyLabel}</div>;
  }

  return (
    <div className="space-y-2">
      {pages.map((page) => (
        <Link
          key={page.path}
          href={docsPathToHref(locale, page.path)}
          className="console-item flex items-center justify-between gap-3 rounded-md px-3 py-3 text-sm leading-6 text-[color:var(--foreground)] transition hover:text-[#00a35c]"
        >
          <span className="min-w-0 truncate">{page.title}</span>
          <span
            className="shrink-0 text-[11px] font-medium text-[color:var(--muted-foreground)]"
            aria-label={copy.console.changedAtLabel}
          >
            {formatChangedAt(locale, page.updatedAt, copy.console.unknown)}
          </span>
        </Link>
      ))}
    </div>
  );
}

export function ConsoleDocChangePanels({
  locale,
  pages
}: {
  locale: SiteLocale;
  pages: RuntimeDocPage[];
}) {
  const copy = getSiteCopy(locale);
  const { isUnreadUrl } = useDocsLive();

  const recentPages = useMemo(() => sortByUpdatedAtDesc(pages).slice(0, 6), [pages]);
  const unreadPages = useMemo(
    () =>
      sortByUpdatedAtDesc(
        pages.filter((page) => page.latestRevisionId && isUnreadUrl(docsPathToHref(locale, page.path)))
      ).slice(0, 6),
    [isUnreadUrl, locale, pages]
  );

  return (
    <>
      <RailPanel>
        <RailSection label={copy.console.unreadChangedDocs}>
          <DocChangeList locale={locale} pages={unreadPages} emptyLabel={copy.console.noUnreadChangedDocs} />
        </RailSection>
      </RailPanel>

      <RailPanel>
        <RailSection label={copy.console.recentChangedDocs}>
          <DocChangeList locale={locale} pages={recentPages} emptyLabel={copy.console.noRecentChangedDocs} />
        </RailSection>
      </RailPanel>
    </>
  );
}
