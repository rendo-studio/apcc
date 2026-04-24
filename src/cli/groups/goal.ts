import { AclipApp, stringArgument } from "@rendo-studio/aclip";
import { loadEndGoal, updateEndGoal } from "../../core/end-goal.js";
import { withGuideHint } from "../guide-hint.js";

export function registerGoalGroup(app: AclipApp) {
  app
    .group("goal", {
      summary: "Manage the long-lived end goal anchor.",
      description: withGuideHint("Set and inspect the project-level end goal tracked in the control plane.")
    })
    .command("set", {
      summary: "Set the end goal.",
      description: withGuideHint(
        "Persist the long-lived end goal summary after the corresponding goal decision has been approved."
      ),
      arguments: [
        stringArgument("name", {
          required: false,
          description: "Optional replacement end goal name."
        }),
        stringArgument("description", {
          required: false,
          description: "Optional replacement end goal description."
        }),
        stringArgument("doc-path", {
          required: false,
          description: "Optional replacement goal doc path relative to the docs package root."
        })
      ],
      examples: [
        "apcc goal set --name 'Make APCC durable' --description 'Turn APCC into a stable project context framework for human developers and development agents.'",
        "apcc goal set --doc-path shared/goal.md"
      ],
      handler: async ({ name, description, "doc-path": docPath }) => {
        if (!name && !description && !docPath) {
          throw new Error("goal set requires at least one of --name, --description, or --doc-path.");
        }

        const goal = await updateEndGoal({
          ...(name ? { name: String(name) } : {}),
          ...(description ? { summary: String(description) } : {}),
          ...(docPath ? { docPath: String(docPath) } : {})
        });

        return {
          goal,
          nextAction: "Update the current plan tree so the phase and progress stay aligned with the end goal."
        };
      }
    })
    .command("show", {
      summary: "Show the end goal.",
      description: withGuideHint("Inspect the currently anchored end goal."),
      examples: ["apcc goal show"],
      handler: async () => ({
        goal: await loadEndGoal()
      })
    });
}
