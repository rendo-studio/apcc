import { AclipApp } from "@rendo-studio/aclip";

import { getStatusSnapshot } from "../../core/status.js";
import { withGuideHint } from "../guide-hint.js";

export function registerStatusCommand(app: AclipApp) {
  app.command("status", {
    summary: "Inspect the derived project status.",
    description: withGuideHint(
      "Read the current control-plane summary derived from project, goal, plan, and task state without mutating files."
    ),
    examples: ["apcc status"],
    handler: async () => ({
      status: await getStatusSnapshot()
    })
  });
}
