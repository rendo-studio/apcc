import { AclipApp } from "@rendo-studio/aclip";

import { getStatusSnapshot } from "../../core/status.js";
import { withGuideHint } from "../guide-hint.js";

export function registerStatusGroup(app: AclipApp) {
  app
    .group("status", {
      summary: "Inspect the derived project status.",
      description: withGuideHint(
        "Inspect the current control-plane summary derived from project, goal, plan, and task state."
      )
    })
    .command("show", {
      summary: "Show the current status snapshot.",
      description: withGuideHint("Read the current control-plane summary without mutating files."),
      examples: ["apcc status show"],
      handler: async () => ({
        status: await getStatusSnapshot()
      })
    });
}
