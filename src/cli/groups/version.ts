import { AclipApp, stringArgument } from "@rendo-studio/aclip";

import {
  createVersionRecord,
  getVersionRecord,
  listVersionRecords,
  updateVersionRecord
} from "../../core/version.js";
import { withGuideHint } from "../guide-hint.js";

function splitCsv(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function assertVersionStatus(value: string): "draft" | "recorded" {
  if (!["draft", "recorded"].includes(value)) {
    throw new Error(`Unsupported version status "${value}". Use draft or recorded.`);
  }

  return value as "draft" | "recorded";
}

export function registerVersionGroup(app: AclipApp) {
  app
    .group("version", {
      summary: "Manage project-level version records.",
      description: withGuideHint(
        "Persist low-frequency project-level version records in .apcc and bind them to authored docs through explicit docPath references."
      )
    })
    .command("new", {
      summary: "Create a draft version record.",
      description: withGuideHint(
        "Create a new draft project-level version record for a version that has become meaningful enough to track explicitly."
      ),
      arguments: [
        stringArgument("version", {
          required: true,
          description: "Version label."
        }),
        stringArgument("title", {
          required: true,
          description: "Human-readable version title."
        }),
        stringArgument("summary", {
          required: true,
          description: "Version summary."
        }),
        stringArgument("doc-path", {
          required: false,
          description: "Optional version doc path relative to the docs package root.",
          flag: "--doc-path"
        }),
        stringArgument("decisionRefs", {
          required: false,
          description: "Optional comma-separated decision refs.",
          flag: "--decision-refs"
        })
      ],
      examples: [
        "apcc version new --version 0.2.0 --title 'Stable framework baseline' --summary 'First version where APCC is considered stable enough for real project use.' --decision-refs define-version-record-policy"
      ],
      handler: async (payload) => ({
        version: await createVersionRecord({
          version: String(payload.version),
          title: String(payload.title),
          summary: String(payload.summary),
          docPath: payload["doc-path"] ? String(payload["doc-path"]) : undefined,
          decisionRefs: splitCsv(payload.decisionRefs ? String(payload.decisionRefs) : undefined)
        })
      })
    })
    .command("list", {
      summary: "List version records.",
      description: withGuideHint("Show project-level version records in descending creation order."),
      examples: ["apcc version list"],
      handler: async () => ({
        version: await listVersionRecords()
      })
    })
    .command("show", {
      summary: "Show one version record.",
      description: withGuideHint("Inspect one project-level version record by id."),
      arguments: [
        stringArgument("id", {
          required: true,
          description: "Version record id."
        })
      ],
      examples: ["apcc version show --id 0-2-0-stable-framework-baseline"],
      handler: async ({ id }) => ({
        version: await getVersionRecord(String(id))
      })
    })
    .command("update", {
      summary: "Update a version record.",
      description: withGuideHint(
        "Append highlights, breaking changes, migration notes, decision refs, validation notes, or adjust the draft/recorded status."
      ),
      arguments: [
        stringArgument("id", {
          required: true,
          description: "Version record id."
        }),
        stringArgument("summary", {
          required: false,
          description: "Optional replacement summary."
        }),
        stringArgument("doc-path", {
          required: false,
          description: "Optional replacement doc path relative to the docs package root.",
          flag: "--doc-path"
        }),
        stringArgument("status", {
          required: false,
          description: "Optional new status: draft or recorded."
        }),
        stringArgument("decisionRefs", {
          required: false,
          description: "Optional comma-separated decision refs to add.",
          flag: "--decision-refs"
        }),
        stringArgument("highlights", {
          required: false,
          description: "Optional comma-separated highlights to add.",
          flag: "--highlights"
        }),
        stringArgument("breakingChanges", {
          required: false,
          description: "Optional comma-separated breaking changes to add.",
          flag: "--breaking-changes"
        }),
        stringArgument("migrationNotes", {
          required: false,
          description: "Optional comma-separated migration notes to add.",
          flag: "--migration-notes"
        }),
        stringArgument("validationSummary", {
          required: false,
          description: "Optional validation summary.",
          flag: "--validation-summary"
        })
      ],
      examples: [
        "apcc version update --id 0-2-0-stable-framework-baseline --highlights 'Removed persisted derived state,Made init safe for existing repos' --status recorded"
      ],
      handler: async (payload) => ({
        version: await updateVersionRecord({
          id: String(payload.id),
          summary: payload.summary ? String(payload.summary) : undefined,
          docPath: payload["doc-path"] ? String(payload["doc-path"]) : undefined,
          status: payload.status ? assertVersionStatus(String(payload.status)) : undefined,
          addDecisionRefs: splitCsv(payload.decisionRefs ? String(payload.decisionRefs) : undefined),
          addHighlights: splitCsv(payload.highlights ? String(payload.highlights) : undefined),
          addBreakingChanges: splitCsv(
            payload.breakingChanges ? String(payload.breakingChanges) : undefined
          ),
          addMigrationNotes: splitCsv(
            payload.migrationNotes ? String(payload.migrationNotes) : undefined
          ),
          validationSummary: payload.validationSummary ? String(payload.validationSummary) : undefined
        })
      })
    })
    .command("record", {
      summary: "Finalize a version record.",
      description: withGuideHint(
        "Mark a draft project-level version record as formally recorded once the version is stable enough to preserve."
      ),
      arguments: [
        stringArgument("id", {
          required: true,
          description: "Version record id."
        })
      ],
      examples: ["apcc version record --id 0-2-0-stable-framework-baseline"],
      handler: async ({ id }) => ({
        version: await updateVersionRecord({
          id: String(id),
          status: "recorded"
        })
      })
    });
}
