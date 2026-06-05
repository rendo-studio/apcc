import { AclipApp, booleanArgument, stringArgument } from "@rendo-studio/aclip";

import { addOwner, loadOwners, updateOwner } from "../../core/owners.js";
import { OWNER_KINDS, OWNER_STATUSES, type OwnerKind, type OwnerStatus } from "../../core/types.js";
import { withGuideHint } from "../guide-hint.js";

function parseOwnerKind(value: string): OwnerKind {
  if (!(OWNER_KINDS as readonly string[]).includes(value)) {
    throw new Error(`Unsupported owner kind "${value}". Use ${OWNER_KINDS.join(", ")}.`);
  }
  return value as OwnerKind;
}

function parseOwnerStatus(value: string): OwnerStatus {
  if (!(OWNER_STATUSES as readonly string[]).includes(value)) {
    throw new Error(`Unsupported owner status "${value}". Use ${OWNER_STATUSES.join(", ")}.`);
  }
  return value as OwnerStatus;
}

export function registerOwnerGroup(app: AclipApp) {
  app
    .group("owner", {
      summary: "Manage workspace owners.",
      description: withGuideHint(
        "Register humans, agents, services, or other operators that can own plan and task work."
      )
    })
    .command("list", {
      summary: "List workspace owners.",
      description: withGuideHint("List registered workspace owners for plan and task assignment."),
      examples: ["apcc owner list"],
      handler: async () => ({
        owner: (await loadOwners()).items
      })
    })
    .command("add", {
      summary: "Add a workspace owner.",
      description: withGuideHint("Register a human, agent, service, or other operator id."),
      arguments: [
        stringArgument("id", {
          required: true,
          description: "Owner id."
        }),
        stringArgument("name", {
          required: true,
          description: "Display name."
        }),
        stringArgument("kind", {
          required: false,
          description: `Optional owner kind: ${OWNER_KINDS.join(", ")}. Defaults to agent.`
        }),
        stringArgument("aliases", {
          required: false,
          description: "Optional comma-separated aliases for collision checks."
        })
      ],
      examples: [
        "apcc owner add --id codex-main --name 'Codex Main' --kind agent",
        "apcc owner add --id yueyo --name 'Yueyo' --kind human --aliases 'human,yueyo-local'"
      ],
      handler: async ({ id, name, kind, aliases }) =>
        addOwner({
          id: String(id),
          name: String(name),
          kind: kind ? parseOwnerKind(String(kind)) : undefined,
          aliases: aliases ? String(aliases) : undefined
        })
    })
    .command("update", {
      summary: "Update a workspace owner.",
      description: withGuideHint("Rename an owner, update aliases, or mark an owner active or inactive."),
      arguments: [
        stringArgument("id", {
          required: true,
          description: "Owner id."
        }),
        stringArgument("name", {
          required: false,
          description: "Optional replacement display name."
        }),
        stringArgument("kind", {
          required: false,
          description: `Optional owner kind: ${OWNER_KINDS.join(", ")}.`
        }),
        stringArgument("status", {
          required: false,
          description: `Optional owner status: ${OWNER_STATUSES.join(", ")}.`
        }),
        stringArgument("aliases", {
          required: false,
          description: "Optional comma-separated alias replacement."
        }),
        booleanArgument("clear-aliases", {
          required: false,
          description: "Clear all aliases.",
          flag: "--clear-aliases"
        })
      ],
      examples: [
        "apcc owner update --id codex-main --status inactive",
        "apcc owner update --id codex-main --aliases 'codex,main-agent'"
      ],
      handler: async ({ id, name, kind, status, aliases, "clear-aliases": clearAliases }) =>
        updateOwner({
          id: String(id),
          name: name ? String(name) : undefined,
          kind: kind ? parseOwnerKind(String(kind)) : undefined,
          status: status ? parseOwnerStatus(String(status)) : undefined,
          aliases: aliases !== undefined ? String(aliases) : undefined,
          clearAliases: Boolean(clearAliases)
        })
    });
}
