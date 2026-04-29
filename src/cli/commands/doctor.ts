import {
  buildDoctorControlPlane,
  doctorResult,
  type DoctorCheck,
  type DoctorCheckSeverity,
  type DoctorCheckStatus
} from "@rendo-studio/aclip";

import { repairWorkspace, validateWorkspace } from "../../core/validate.js";
import { withGuideHint } from "../guide-hint.js";

type ValidationResult = Awaited<ReturnType<typeof validateWorkspace>>;
type RepairResult = Awaited<ReturnType<typeof repairWorkspace>>;

const PASS_STATUS: DoctorCheckStatus = "pass";
const WARN_STATUS: DoctorCheckStatus = "warn";
const FAIL_STATUS: DoctorCheckStatus = "fail";

const LOW_SEVERITY: DoctorCheckSeverity = "low";
const MEDIUM_SEVERITY: DoctorCheckSeverity = "medium";
const HIGH_SEVERITY: DoctorCheckSeverity = "high";

function getYamlParseIssues(validation: ValidationResult): string[] {
  return validation.schemaIssues.filter((issue) => issue.startsWith("Failed to parse YAML file "));
}

function createValidationChecks(validation: ValidationResult): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  const yamlParseIssues = getYamlParseIssues(validation);

  if (validation.missingFiles.length > 0) {
    checks.push({
      id: "missing-managed-files",
      status: FAIL_STATUS,
      severity: HIGH_SEVERITY,
      category: "workspace",
      summary: `${validation.missingFiles.length} managed file(s) or docs anchors are missing.`,
      hint: "The workspace is incomplete and current commands may operate on partial state.",
      remediation: [
        {
          summary: "Restore missing managed files and docs anchors.",
          command: "apcc doctor fix",
          automatable: true
        }
      ]
    });
  }

  const missingMetadata = [
    !validation.metadataChecks.overview ? "project overview doc metadata" : null,
    !validation.metadataChecks.goal ? "goal doc metadata" : null
  ].filter((item): item is string => Boolean(item));

  if (missingMetadata.length > 0) {
    checks.push({
      id: "docs-frontmatter",
      status: FAIL_STATUS,
      severity: MEDIUM_SEVERITY,
      category: "docs",
      summary: `Missing APCC frontmatter in ${missingMetadata.join(" and ")}.`,
      hint: "Managed docs anchors must keep the minimum `name` and `description` metadata.",
      remediation: [
        {
          summary: "Rehydrate the managed docs anchors.",
          command: "apcc doctor fix",
          automatable: true
        }
      ]
    });
  }

  if (yamlParseIssues.length > 0) {
    checks.push({
      id: "workspace-yaml-parse",
      status: FAIL_STATUS,
      severity: HIGH_SEVERITY,
      category: "schema",
      summary: `${yamlParseIssues.length} workspace YAML parse issue(s) detected.`,
      hint: yamlParseIssues.join("\n")
    });
  }

  const remainingSchemaIssues = validation.schemaIssues.filter((issue) => !yamlParseIssues.includes(issue));
  if (remainingSchemaIssues.length > 0) {
    checks.push({
      id: "workspace-schema",
      status: FAIL_STATUS,
      severity: HIGH_SEVERITY,
      category: "schema",
      summary: `${remainingSchemaIssues.length} workspace schema issue(s) detected.`,
      hint: "The workspace metadata or config is stale or incomplete.",
      remediation: [
        {
          summary: "Backfill or upgrade workspace metadata and config.",
          command: "apcc doctor fix",
          automatable: true
        }
      ]
    });
  }

  if (validation.warnings.length > 0) {
    checks.push({
      id: "workspace-warnings",
      status: WARN_STATUS,
      severity: MEDIUM_SEVERITY,
      category: "workspace",
      summary: `${validation.warnings.length} warning(s) detected in the current workspace.`,
      hint: "The workspace is usable, but it is not fully aligned with the current managed template."
    });
  }

  if (checks.length === 0) {
    checks.push({
      id: "workspace-health",
      status: PASS_STATUS,
      severity: LOW_SEVERITY,
      category: "workspace",
      summary: "Workspace passed all APCC doctor checks."
    });
  }

  return checks;
}

function createCheckGuidance(validation: ValidationResult): string {
  if (getYamlParseIssues(validation).length > 0) {
    return "Fix the reported YAML file paths first, then run `apcc doctor check` again before retrying other APCC commands.";
  }

  if (validation.ok && validation.warnings.length === 0) {
    return "Workspace is healthy. No APCC repair action is required.";
  }

  if (validation.ok) {
    return "Workspace is usable, but review the warning checks before relying on it as a release baseline.";
  }

  if (validation.repairNeeded) {
    return "Run `apcc doctor fix` to restore managed files and workspace metadata, then rerun `apcc doctor check`.";
  }

  return "Resolve the failing checks, then rerun `apcc doctor check`.";
}

function createFixGuidance(repair: RepairResult): string {
  if (repair.validation.ok) {
    return "Workspace repair completed successfully. The workspace now passes APCC doctor checks.";
  }

  return "Workspace repair ran, but some failing checks remain. Inspect the remaining doctor checks before continuing.";
}

export function createDoctorControlPlane() {
  return buildDoctorControlPlane({
    groupSummary: "Diagnose and repair the current workspace.",
    groupDescription: withGuideHint(
      "Run APCC workspace diagnostics or apply managed repairs through the reserved ACLIP doctor control plane."
    ),
    checkDescription: withGuideHint(
      "Run a diagnostic pass over APCC anchors, metadata, migration state, and task-tree constraints without mutating files."
    ),
    checkExamples: ["apcc doctor check"],
    checkHandler: async () => {
      const validation = await validateWorkspace();
      return {
        doctor: doctorResult({
          checks: createValidationChecks(validation),
          guidance_md: createCheckGuidance(validation)
        })
      };
    },
    fixDescription: withGuideHint(
      "Repair the current workspace by backfilling managed files and workspace metadata, then rerun the APCC doctor checks."
    ),
    fixExamples: ["apcc doctor fix"],
    fixHandler: async () => {
      const repair = await repairWorkspace();
      return {
        doctor: {
          repaired: true,
          workspace: repair.workspace,
          ...doctorResult({
            checks: createValidationChecks(repair.validation),
            guidance_md: createFixGuidance(repair)
          })
        }
      };
    }
  });
}