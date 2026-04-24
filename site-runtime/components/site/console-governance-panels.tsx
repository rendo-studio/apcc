import Link from "next/link";

import type { SiteLocale } from "../../lib/i18n";
import type { ControlPlaneSnapshot } from "../../lib/runtime-data";
import { formatSiteDate, getSiteCopy } from "../../lib/site-copy";
import { RailPanel, RailSection, StatusBadge, docsPathToHref } from "./docs-rail-shared";

function formatTimestamp(locale: SiteLocale, value: string) {
  return formatSiteDate(locale, value, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function ConsoleGovernancePanels({
  locale,
  snapshot
}: {
  locale: SiteLocale;
  snapshot: ControlPlaneSnapshot;
}) {
  const copy = getSiteCopy(locale);
  const versions = [...(snapshot.versions?.items ?? [])].sort((left, right) => {
    const leftTime = left.recordedAt ?? left.createdAt;
    const rightTime = right.recordedAt ?? right.createdAt;
    return rightTime.localeCompare(leftTime);
  });
  const decisions = [...(snapshot.decisions?.items ?? [])].sort((left, right) => {
    const leftTime = left.decidedAt ?? left.createdAt;
    const rightTime = right.decidedAt ?? right.createdAt;
    return rightTime.localeCompare(leftTime);
  });

  return (
    <>
      <RailPanel>
        <RailSection label={copy.console.projectVersions}>
          {versions.length === 0 ? (
            <div className="space-y-2">
              <div className="text-sm leading-6 text-[color:var(--muted-foreground)]">{copy.console.noProjectVersions}</div>
              <div className="text-xs leading-5 text-[color:var(--muted-foreground)]">{copy.console.versionEmptyHint}</div>
            </div>
          ) : (
            <div className="space-y-2">
              {versions.map((record) => {
                const timestamp = record.recordedAt ?? record.createdAt;
                const timestampLabel = record.recordedAt
                  ? copy.console.recordedAtLabel
                  : copy.console.createdAtLabel;
                const content = (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-[color:var(--foreground)]">
                          {record.version} {record.title}
                        </div>
                        <div className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                          {record.summary}
                        </div>
                        <div className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                          {timestampLabel}: {formatTimestamp(locale, timestamp)}
                        </div>
                      </div>
                      <StatusBadge status={record.status} locale={locale} />
                    </div>
                  </>
                );

                if (record.docPath) {
                  return (
                    <Link
                      key={record.id}
                      href={docsPathToHref(locale, record.docPath)}
                      className="console-item block rounded-md px-3 py-2 transition hover:text-[#0072f5]"
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <div key={record.id} className="console-item rounded-md px-3 py-2">
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </RailSection>
      </RailPanel>

      <RailPanel>
        <RailSection label={copy.console.decisions}>
          {decisions.length === 0 ? (
            <div className="space-y-2">
              <div className="text-sm leading-6 text-[color:var(--muted-foreground)]">{copy.console.noDecisions}</div>
              <div className="text-xs leading-5 text-[color:var(--muted-foreground)]">{copy.console.decisionEmptyHint}</div>
            </div>
          ) : (
            <div className="space-y-2">
              {decisions.map((record) => {
                const timestamp = record.decidedAt ?? record.createdAt;
                const timestampLabel = record.decidedAt
                  ? copy.console.decidedAtLabel
                  : copy.console.createdAtLabel;
                const content = (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-[color:var(--foreground)]">{record.name}</div>
                        <div className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                          {record.description}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                          <span>
                            {copy.console.categoryLabel}: {record.category}
                          </span>
                          <span>
                            {timestampLabel}: {formatTimestamp(locale, timestamp)}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={record.status} locale={locale} />
                    </div>
                  </>
                );

                if (record.docPath) {
                  return (
                    <Link
                      key={record.id}
                      href={docsPathToHref(locale, record.docPath)}
                      className="console-item block rounded-md px-3 py-2 transition hover:text-[#0072f5]"
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <div key={record.id} className="console-item rounded-md px-3 py-2">
                    {content}
                  </div>
                );
              })}
            </div>
          )}
        </RailSection>
      </RailPanel>
    </>
  );
}
