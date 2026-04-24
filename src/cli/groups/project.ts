import { AclipApp, stringArgument } from "@rendo-studio/aclip";

import { loadProjectOverview, updateProjectOverview } from "../../core/project-overview.js";
import { withGuideHint } from "../guide-hint.js";

export function registerProjectGroup(app: AclipApp) {
  app
    .group("project", {
      summary: "Manage the project overview anchor.",
      description: withGuideHint(
        "Inspect and update the structured project overview stored in the control plane."
      )
    })
    .command("show", {
      summary: "Show the current project overview.",
      description: withGuideHint("Read the current project name, summary, and overview doc path."),
      examples: ["apcc project show"],
      handler: async () => ({
        project: await loadProjectOverview()
      })
    })
    .command("set", {
      summary: "Update the project overview.",
      description: withGuideHint(
        "Set the structured project name, summary, and optional overview doc path."
      ),
      arguments: [
        stringArgument("name", {
          required: false,
          description: "Optional replacement project name."
        }),
        stringArgument("summary", {
          required: false,
          description: "Optional replacement project summary."
        }),
        stringArgument("doc-path", {
          required: false,
          description: "Optional replacement overview doc path relative to docs/."
        })
      ],
      examples: [
        "apcc project set --name APCC --summary 'agent-first project context framework for development agents.'",
        "apcc project set --summary 'Shared project context workspace for a service repo.' --doc-path shared/overview.md"
      ],
      handler: async (input) => {
        if (!input.name && !input.summary && !input["doc-path"]) {
          throw new Error("project set requires at least one of --name, --summary, or --doc-path.");
        }

        return {
          project: await updateProjectOverview({
            ...(input.name ? { name: String(input.name) } : {}),
            ...(input.summary ? { summary: String(input.summary) } : {}),
            ...(input["doc-path"] ? { docPath: String(input["doc-path"]) } : {})
          })
        };
      }
    });
}
