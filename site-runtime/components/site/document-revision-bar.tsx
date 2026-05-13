import Link from "next/link";

import type { SiteLocale } from "../../lib/i18n";
import type { RuntimeDocRevisionRecord } from "../../lib/runtime-data";
import { formatSiteDate, getSiteCopy } from "../../lib/site-copy";

function formatTimestamp(locale: SiteLocale, value: string): string {
  return formatSiteDate(locale, value, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function withQuery(pathname: string, key: "revision" | "compare", value?: string): string {
  if (!value) {
    return pathname;
  }

  const params = new URLSearchParams();
  params.set(key, value);
  return `${pathname}?${params.toString()}`;
}

export function DocumentRevisionSidebar({
  locale,
  pathname,
  record,
  activeRevisionId,
  compareRevisionId
}: {
  locale: SiteLocale;
  pathname: string;
  record: RuntimeDocRevisionRecord;
  activeRevisionId: string | null;
  compareRevisionId: string | null;
}) {
  const copy = getSiteCopy(locale);
  const latestRevision = record.revisions.at(-1);
  const revisions = [...record.revisions].reverse();

  if (!latestRevision) {
    return null;
  }

  return (
    <section className="mt-6 border-t border-[color:var(--color-border)] pt-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-neutral-950">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3 dark:border-white/10">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-950 dark:text-white">{copy.revisions.title}</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">
              {copy.revisions.updatedSummary(formatTimestamp(locale, record.updatedAt), record.revisions.length)}
            </div>
          </div>
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {record.revisions.length}
          </span>
        </div>

        <div className="mt-4 max-h-[24rem] space-y-2 overflow-y-auto pr-1">
          {revisions.map((revision) => {
          const isCurrent = revision.id === latestRevision.id;
          const isActive = revision.id === activeRevisionId || revision.id === compareRevisionId;

          return (
            <div
              key={revision.id}
              className={`rounded-lg border px-3 py-2.5 transition ${
                isActive
                  ? "border-[#00a35c] bg-[#f3fff9]"
                  : "border-[color:var(--color-border)] bg-[color:var(--muted)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={isCurrent ? pathname : withQuery(pathname, "revision", revision.id)}
                  className={`text-sm font-medium transition ${
                    isActive && !compareRevisionId
                      ? "text-[#00663a]"
                      : "text-[color:var(--foreground)] hover:text-[#00a35c]"
                  }`}
                >
                  {isCurrent ? copy.revisions.currentVersion : formatTimestamp(locale, revision.createdAt)}
                </Link>
                {isCurrent ? (
                  <span className="rounded-full bg-[color:var(--foreground)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--background)]">
                    {copy.revisions.live}
                  </span>
                ) : null}
              </div>

              {!isCurrent ? (
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <Link
                    href={withQuery(pathname, "revision", revision.id)}
                    className={`font-medium transition ${
                      activeRevisionId === revision.id
                        ? "text-[#00663a]"
                        : "text-[color:var(--muted-foreground)] hover:text-[#00a35c]"
                    }`}
                  >
                    {copy.revisions.viewRevision}
                  </Link>
                  <Link
                    href={withQuery(pathname, "compare", revision.id)}
                    className={`font-medium transition ${
                      compareRevisionId === revision.id
                        ? "text-[#00663a]"
                        : "text-[color:var(--muted-foreground)] hover:text-[#00a35c]"
                    }`}
                  >
                    {copy.revisions.compareCurrent}
                  </Link>
                </div>
              ) : null}
            </div>
          );
        })}
        </div>

        {activeRevisionId || compareRevisionId ? (
          <Link
            href={pathname}
            className="mt-4 inline-flex text-xs font-medium text-[color:var(--muted-foreground)] transition hover:text-[#00a35c]"
          >
            {copy.revisions.backToCurrent}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
