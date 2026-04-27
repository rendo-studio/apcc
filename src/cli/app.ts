import { readFileSync } from "node:fs";

import { AclipApp } from "@rendo-studio/aclip";

import { registerDecisionGroup } from "./groups/decision.js";
import { registerGoalGroup } from "./groups/goal.js";
import { registerProjectGroup } from "./groups/project.js";
import { registerPlanGroup } from "./groups/plan.js";
import { registerStatusCommand } from "./groups/status.js";
import { registerTaskGroup } from "./groups/task.js";
import { registerSiteGroup } from "./groups/site.js";
import { registerVersionGroup } from "./groups/version.js";
import { createDoctorControlPlane } from "./commands/doctor.js";
import { registerInitCommand } from "./commands/init.js";
import { registerGuideCommand } from "./commands/guide.js";
import { withGuideHint } from "./guide-hint.js";
import { getWorkflowSkillPackageDir } from "../core/workflow-guide.js";

function loadCliVersion(): string {
  const packageJson = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8")
  ) as { version?: string };
  return packageJson.version ?? "0.1.0";
}

export function createApp() {
  const doctor = createDoctorControlPlane();
  const app = new AclipApp({
    name: "apcc",
    version: loadCliVersion(),
    summary: "APCC CLI.",
    description: withGuideHint(
      "A agent-first project context framework for human developers and development agents."
    ),
    commands: doctor.commands,
    commandGroups: [doctor.commandGroup]
  });

  registerInitCommand(app);
  registerGuideCommand(app);
  registerProjectGroup(app);
  registerDecisionGroup(app);
  registerGoalGroup(app);
  registerPlanGroup(app);
  registerStatusCommand(app);
  registerTaskGroup(app);
  registerVersionGroup(app);
  registerSiteGroup(app);
  app.addCliSkill(getWorkflowSkillPackageDir());

  return app;
}

export const app = createApp();
