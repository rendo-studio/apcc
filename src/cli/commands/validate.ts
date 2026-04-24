import { AclipApp, booleanArgument } from "@rendo-studio/aclip";
import { repairWorkspace, validateWorkspace } from "../../core/validate.js";
import { withGuideHint } from "../guide-hint.js";

export function registerValidateCommand(app: AclipApp) {
  app.command("validate", {
    summary: "Validate the current workspace.",
    description: withGuideHint(
      "Run a validation pass over APCC anchors, metadata, migration state, and task-tree constraints. Use --repair when the workspace needs recovery or managed files/schema metadata must be backfilled."
    ),
    arguments: [
      booleanArgument("repair", {
        required: false,
        description: "Attempt to repair the current workspace by backfilling managed files and schema metadata.",
        flag: "--repair"
      })
    ],
    examples: ["apcc validate", "apcc validate --repair"],
    handler: async ({ repair }) =>
      repair
        ? {
            validation: await repairWorkspace()
          }
        : {
            validation: await validateWorkspace()
          }
  });
}
