import Link from "next/link";

import type { SiteLocale } from "../../lib/i18n";
import type { ControlPlaneSnapshot } from "../../lib/runtime-data";
import { getSiteCopy } from "../../lib/site-copy";
import { Progress } from "../ui/progress";
import { DataList, RailPanel, RailSection, StatusBadge, docsPathToHref } from "./docs-rail-shared";
import { ConsoleDocChangePanels } from "./console-doc-change-panels";
import { ConsoleGovernancePanels } from "./console-governance-panels";

export function ConsoleOverviewView({
  locale,
  snapshot
}: {
  locale: SiteLocale;
  snapshot: ControlPlaneSnapshot;
}) {
  const copy = getSiteCopy(locale);
  const projectName = snapshot.project?.name ?? copy.console.projectFallback;
  const projectSummary = snapshot.project?.summary ?? copy.console.missingProjectSummary;
  const projectDocHref = snapshot.project?.docPath ? docsPathToHref(locale, snapshot.project.docPath) : null;
  const endGoalName = snapshot.endGoal?.name ?? copy.console.noEndGoal;
  const endGoalSummary = snapshot.endGoal?.summary ?? copy.console.missingEndGoalSummary;
  const successCriteria = snapshot.endGoal?.successCriteria ?? [];
  const nonGoals = snapshot.endGoal?.nonGoals ?? [];
  const progress = snapshot.progress?.percent ?? 0;
  const phase = snapshot.status?.phase ?? copy.console.unknown;

  return (
    <div className="space-y-6">
      <section className="console-surface rounded-lg px-6 py-6">
        <div className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--muted-foreground)]">
          {copy.console.projectLabel}
        </div>
        <h1 className="mt-3 text-[2.25rem] font-semibold tracking-[-0.06em] text-[color:var(--foreground)]">
          {projectName}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-[color:var(--muted-foreground)]">{projectSummary}</p>
        {projectDocHref ? (
          <div className="mt-5">
            <Link
              href={projectDocHref}
              className="text-sm font-medium text-[#0072f5] underline underline-offset-4"
            >
              {copy.console.readProjectOverview}
            </Link>
          </div>
        ) : null}
      </section>

      <div className="space-y-6">
        <RailPanel>
          <RailSection label={copy.console.endGoal}>
            <div className="space-y-4">
              <div className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--foreground)]">{endGoalName}</div>
              <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">{endGoalSummary}</p>
              <div className="rounded-md bg-[color:var(--muted)] px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--muted-foreground)]">
                      {copy.console.progress}
                    </div>
                    <div className="mt-1 text-2xl font-semibold tracking-[-0.05em] text-[color:var(--foreground)]">
                      {progress}%
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={phase} locale={locale} />
                    <Link
                      href={`/${locale}/docs/console/plans`}
                      className="rounded-md bg-[color:var(--foreground)] px-3 py-2 text-sm font-medium text-[color:var(--background)]"
                    >
                      {copy.console.viewPlans}
                    </Link>
                  </div>
                </div>
                <div className="mt-4">
                  <Progress value={progress} />
                </div>
              </div>
            </div>
          </RailSection>
        </RailPanel>

        <div className="grid gap-6 lg:grid-cols-2">
          <RailPanel>
            <RailSection label={copy.console.successCriteria}>
              <DataList items={successCriteria} emptyLabel={copy.console.noSuccessCriteria} />
            </RailSection>
          </RailPanel>

          <RailPanel>
            <RailSection label={copy.console.nonGoals}>
              <DataList items={nonGoals} emptyLabel={copy.console.noNonGoals} />
            </RailSection>
          </RailPanel>

          <ConsoleDocChangePanels locale={locale} pages={snapshot.docs.changedPages} />
          <ConsoleGovernancePanels locale={locale} snapshot={snapshot} />
        </div>
      </div>
    </div>
  );
}
