import type { SiteLocale } from "../../lib/i18n";
import type { ControlPlaneSnapshot, RuntimeTaskNode } from "../../lib/runtime-data";
import { getSiteCopy } from "../../lib/site-copy";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { DataList, RailPanel, RailSection, StatusBadge } from "./docs-rail-shared";

type RuntimePlanNode = NonNullable<ControlPlaneSnapshot["plans"]>["items"][number];

interface PlanTreeNode extends RuntimePlanNode {
  children: PlanTreeNode[];
}

interface PlanProgress {
  total: number;
  done: number;
  percent: number;
}

function buildPlanTree(plans: RuntimePlanNode[]): PlanTreeNode[] {
  const nodes = new Map<string, PlanTreeNode>();
  const roots: PlanTreeNode[] = [];

  for (const plan of plans) {
    nodes.set(plan.id, {
      ...plan,
      children: []
    });
  }

  for (const node of nodes.values()) {
    if (node.parentPlanId && nodes.has(node.parentPlanId)) {
      nodes.get(node.parentPlanId)!.children.push(node);
      continue;
    }

    roots.push(node);
  }

  return roots;
}

function collectDescendantPlanIds(plan: PlanTreeNode): string[] {
  return plan.children.flatMap((child) => [child.id, ...collectDescendantPlanIds(child)]);
}

function buildTaskTreeForPlan(tasks: NonNullable<ControlPlaneSnapshot["tasks"]>["items"], planId: string): RuntimeTaskNode[] {
  const taskSet = new Set(tasks.filter((task) => task.planRef === planId).map((task) => task.id));
  const nodes = new Map<string, RuntimeTaskNode>();
  const roots: RuntimeTaskNode[] = [];

  for (const task of tasks) {
    if (!taskSet.has(task.id)) {
      continue;
    }

    nodes.set(task.id, {
      ...task,
      children: []
    });
  }

  for (const node of nodes.values()) {
    if (node.parentTaskId && nodes.has(node.parentTaskId)) {
      nodes.get(node.parentTaskId)!.children.push(node);
      continue;
    }

    roots.push(node);
  }

  return roots;
}

function createTaskTreesByPlan(tasks: NonNullable<ControlPlaneSnapshot["tasks"]>["items"]): Map<string, RuntimeTaskNode[]> {
  const planIds = new Set(tasks.map((task) => task.planRef));
  return new Map([...planIds].map((planId) => [planId, buildTaskTreeForPlan(tasks, planId)]));
}

function createPlanProgress(planTrees: PlanTreeNode[], tasks: NonNullable<ControlPlaneSnapshot["tasks"]>["items"]): Map<string, PlanProgress> {
  const progress = new Map<string, PlanProgress>();

  function visit(plan: PlanTreeNode): void {
    const relevantPlanIds = new Set([plan.id, ...collectDescendantPlanIds(plan)]);
    const actionableTasks = tasks.filter((task) => task.countedForProgress && relevantPlanIds.has(task.planRef));
    const done = actionableTasks.filter((task) => task.status === "done").length;
    progress.set(plan.id, {
      total: actionableTasks.length,
      done,
      percent: actionableTasks.length > 0 ? Math.round((done / actionableTasks.length) * 100) : 0
    });

    for (const child of plan.children) {
      visit(child);
    }
  }

  for (const plan of planTrees) {
    visit(plan);
  }

  return progress;
}

function TaskAccordionGroup({
  locale,
  items
}: {
  locale: SiteLocale;
  items: RuntimeTaskNode[];
}) {
  const copy = getSiteCopy(locale);
  return (
    <Accordion type="multiple" className="-my-2 w-full">
      {items.map((item) => (
        <AccordionItem key={item.id} value={item.id}>
          <AccordionTrigger className="py-3">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-[color:var(--foreground)]">{item.name}</div>
                <div className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                  {item.summary ?? item.name}
                </div>
              </div>
              <StatusBadge status={item.status} locale={locale} />
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">{item.summary ?? item.name}</p>
            <div className="flex flex-wrap gap-2">
              <Badge>{item.countedForProgress ? copy.console.progressUnit : copy.console.groupingNode}</Badge>
            </div>
            {item.children.length > 0 ? (
              <div className="border-l border-[color:var(--color-border)] pl-4">
                <TaskAccordionGroup locale={locale} items={item.children} />
              </div>
            ) : null}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function PlanAccordionGroup({
  locale,
  items,
  taskTreesByPlan,
  progressByPlan
}: {
  locale: SiteLocale;
  items: PlanTreeNode[];
  taskTreesByPlan: Map<string, RuntimeTaskNode[]>;
  progressByPlan: Map<string, PlanProgress>;
}) {
  const copy = getSiteCopy(locale);
  return (
    <Accordion type="multiple" className="-my-2 w-full">
      {items.map((item) => {
        const progress = progressByPlan.get(item.id) ?? { done: 0, total: 0, percent: 0 };
        const directTasks = taskTreesByPlan.get(item.id) ?? [];
        return (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger className="py-3">
              <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[color:var(--foreground)]">{item.name}</div>
                  <div className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                    {item.summary ?? item.name}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 w-28 max-w-[40vw] overflow-hidden rounded-full bg-[color:var(--muted)]">
                      <div className="h-full bg-[color:var(--foreground)]" style={{ width: `${progress.percent}%` }} />
                    </div>
                    <div className="text-xs text-[color:var(--muted-foreground)]">
                      {progress.done} / {progress.total}
                    </div>
                  </div>
                </div>
                <StatusBadge status={item.status} locale={locale} />
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">{item.summary ?? item.name}</p>
              <div className="flex flex-wrap gap-2">
                <Badge>{item.id}</Badge>
                <Badge>{item.children.length} {copy.console.childPlans}</Badge>
                <Badge>{directTasks.length} {copy.console.directTasks}</Badge>
              </div>

              {directTasks.length > 0 ? (
                <div className="rounded-md bg-[color:var(--muted)] px-3 py-2">
                  <div className="mb-1 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--muted-foreground)]">
                    {copy.console.directTasks}
                  </div>
                  <TaskAccordionGroup locale={locale} items={directTasks} />
                </div>
              ) : (
                <div className="rounded-md bg-[color:var(--muted)] px-3 py-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                  {copy.console.noPlanTasks}
                </div>
              )}

              {item.children.length > 0 ? (
                <div className="border-l border-[color:var(--color-border)] pl-4">
                  <div className="mb-1 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--muted-foreground)]">
                    {copy.console.childPlans}
                  </div>
                  <PlanAccordionGroup
                    locale={locale}
                    items={item.children}
                    taskTreesByPlan={taskTreesByPlan}
                    progressByPlan={progressByPlan}
                  />
                </div>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

export function ConsoleTasksView({
  locale,
  snapshot
}: {
  locale: SiteLocale;
  snapshot: ControlPlaneSnapshot;
}) {
  const copy = getSiteCopy(locale);
  const allPlans = snapshot.plans?.items ?? [];
  const planTree = buildPlanTree(allPlans);
  const allTasks = snapshot.tasks?.items ?? [];
  const taskTreesByPlan = createTaskTreesByPlan(allTasks);
  const progressByPlan = createPlanProgress(planTree, allTasks);
  const totalPlans = allPlans.length;
  const donePlans = allPlans.filter((item) => item.status === "done").length;
  const actionableTasks = allTasks.filter((item) => item.countedForProgress);
  const totalTasks = actionableTasks.length;
  const doneTasks = actionableTasks.filter((item) => item.status === "done").length;
  const recentCompleted = snapshot.tasks?.recentCompleted ?? [];
  const blockers = snapshot.tasks?.blockers ?? [];
  const planPercent = totalPlans > 0 ? Math.round((donePlans / totalPlans) * 100) : 0;
  const taskPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <RailPanel className="min-w-0">
        <RailSection label={copy.console.planTree} className="max-h-[72rem] overflow-y-auto">
          {planTree.length ? (
            <PlanAccordionGroup
              locale={locale}
              items={planTree}
              taskTreesByPlan={taskTreesByPlan}
              progressByPlan={progressByPlan}
            />
          ) : (
            <div className="text-sm leading-6 text-[color:var(--muted-foreground)]">{copy.console.noPlanData}</div>
          )}
        </RailSection>
      </RailPanel>

      <div className="space-y-6">
        <RailPanel>
          <RailSection label={copy.console.progress}>
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-[color:var(--foreground)]">{copy.console.plans}</div>
                  <div className="text-sm text-[color:var(--muted-foreground)]">{donePlans} / {totalPlans}</div>
                </div>
                <Progress value={planPercent} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-[color:var(--foreground)]">{copy.console.tasks}</div>
                  <div className="text-sm text-[color:var(--muted-foreground)]">{doneTasks} / {totalTasks}</div>
                </div>
                <Progress value={taskPercent} />
              </div>

              <div className="pt-1">
                <StatusBadge status={snapshot.status?.phase ?? copy.console.unknown} locale={locale} />
              </div>
            </div>
          </RailSection>
        </RailPanel>

        <RailPanel>
          <RailSection label={copy.console.recentCompletion}>
            <DataList items={recentCompleted} emptyLabel={copy.console.noRecentCompletion} />
          </RailSection>
        </RailPanel>

        <RailPanel>
          <RailSection label={copy.console.blockers}>
            <DataList
              items={blockers.filter((item) => item !== copy.console.noExplicitBlocker)}
              emptyLabel={copy.console.noActiveBlockers}
            />
          </RailSection>
        </RailPanel>
      </div>
    </div>
  );
}
