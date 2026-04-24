import { AclipApp } from "@rendo-studio/aclip";

import { registerDecisionGroup } from "./groups/decision.js";
import { registerGoalGroup } from "./groups/goal.js";
import { registerProjectGroup } from "./groups/project.js";
import { registerPlanGroup } from "./groups/plan.js";
import { registerStatusGroup } from "./groups/status.js";
import { registerTaskGroup } from "./groups/task.js";
import { registerSiteGroup } from "./groups/site.js";
import { registerVersionGroup } from "./groups/version.js";
import { registerValidateCommand } from "./commands/validate.js";
import { registerInitCommand } from "./commands/init.js";
import { registerGuideCommand } from "./commands/guide.js";
import { withGuideHint } from "./guide-hint.js";

export function createApp() {
  const app = new AclipApp({
    name: "apcc",
    version: "0.1.0",
    summary: "APCC CLI.",
    description: withGuideHint(
      "A agent-first project context framework for human developers and development agents."
    )
  });

  registerInitCommand(app);
  registerGuideCommand(app);
  registerProjectGroup(app);
  registerDecisionGroup(app);
  registerGoalGroup(app);
  registerPlanGroup(app);
  registerStatusGroup(app);
  registerTaskGroup(app);
  registerVersionGroup(app);
  registerSiteGroup(app);
  registerValidateCommand(app);

  return app;
}

export const app = createApp();
