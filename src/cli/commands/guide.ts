import { AclipApp, stringArgument } from "@rendo-studio/aclip";

import { loadGuide } from "../../core/workflow-guide.js";

export function registerGuideCommand(app: AclipApp) {
  app.command("guide", {
    summary: "Show bundled APCC guide topics.",
    description:
      "List bundled APCC public guide topics or read one topic. The reserved workflow topic shows the Agent workflow guide.",
    arguments: [
      stringArgument("topic", {
        positional: true,
        required: false,
        description: "Optional bundled guide topic. Defaults to the topic index."
      })
    ],
    examples: ["apcc guide", "apcc guide workflow", "apcc guide <topic>"],
    handler: async ({ topic }) => ({
      guide: await loadGuide(topic ? String(topic) : undefined)
    })
  });
}
