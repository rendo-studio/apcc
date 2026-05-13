import Link from "next/link";
import { Clock3, Edit3, History } from "lucide-react";

import type { SiteLocale } from "../../lib/i18n";
import type { RuntimeDocRevisionRecord } from "../../lib/runtime-data";
import { formatSiteDate } from "../../lib/site-copy";
import { docsSlugToUrl } from "../../lib/docs-path";

const docCopy = {
  "zh-CN": {
    docs: "文档",
    updated: "最近更新",
    history: "查看历史",
    edit: "编辑建议",
    unknown: "未知"
  },
  en: {
    docs: "Docs",
    updated: "Updated",
    history: "History",
    edit: "Suggest edit",
    unknown: "Unknown"
  }
} satisfies Record<SiteLocale, Record<string, string>>;

function formatUpdatedAt(locale: SiteLocale, value: string | null | undefined): string {
  if (!value) {
    return docCopy[locale].unknown;
  }

  return formatSiteDate(locale, value, {
    month: "short",
    day: "numeric"
  });
}

function titleFromSegment(value: string): string {
  return decodeURIComponent(value)
    .replace(/[()]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function DocArticleMeta({
  locale,
  slug,
  title,
  updatedAt,
  revisionRecord
}: {
  locale: SiteLocale;
  slug: string[];
  title: string;
  updatedAt: string | null | undefined;
  revisionRecord: RuntimeDocRevisionRecord | null;
}) {
  const copy = docCopy[locale];
  const crumbs = slug.slice(0, -1);
  const pathname = docsSlugToUrl(locale, slug);
  const historyHref = revisionRecord?.latestRevisionId ? `${pathname}?revision=${revisionRecord.latestRevisionId}` : pathname;

  return (
    <div className="not-prose mb-5">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500" aria-label="Breadcrumb">
        <Link href={`/${locale}`} className="transition hover:text-blue-600">
          {copy.docs}
        </Link>
        {crumbs.map((segment, index) => {
          const href = docsSlugToUrl(locale, crumbs.slice(0, index + 1));
          return (
            <span key={`${segment}-${index}`} className="inline-flex items-center gap-2">
              <span>/</span>
              <Link href={href} className="transition hover:text-blue-600">
                {titleFromSegment(segment)}
              </Link>
            </span>
          );
        })}
        <span className="inline-flex min-w-0 items-center gap-2">
          <span>/</span>
          <span className="truncate text-slate-700 dark:text-slate-200">{title}</span>
        </span>
      </nav>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2.5 text-sm text-slate-500">
        <span className="inline-flex items-center gap-2">
          <Clock3 className="size-4" />
          {copy.updated}: {formatUpdatedAt(locale, updatedAt)}
        </span>
        <Link href={historyHref} className="inline-flex items-center gap-2 transition hover:text-blue-600">
          <History className="size-4" />
          {copy.history}
        </Link>
        <Link href={pathname} className="inline-flex items-center gap-2 transition hover:text-blue-600">
          <Edit3 className="size-4" />
          {copy.edit}
        </Link>
      </div>
    </div>
  );
}
