import { assertControlPlaneId } from "./ids.js";
import { isFileNotFoundError, readYamlFile, writeYamlFile } from "./storage.js";
import { getWorkspacePaths } from "./workspace.js";
import { withWorkspaceMutationLock } from "./workspace-mutation.js";
import { OWNER_KINDS, OWNER_STATUSES, type OwnerKind, type OwnerRecord, type OwnerState, type OwnerStatus } from "./types.js";

export function emptyOwnerState(): OwnerState {
  return {
    items: []
  };
}

function normalizeAliases(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

export function normalizeOwnerRecord(raw: Partial<OwnerRecord>): OwnerRecord {
  return {
    id: raw.id ?? "",
    name: raw.name ?? raw.id ?? "",
    kind: raw.kind ?? "agent",
    status: raw.status ?? "active",
    aliases: normalizeAliases(raw.aliases),
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? raw.createdAt ?? null
  };
}

export function normalizeOwnerState(state: OwnerState): OwnerState {
  return {
    items: Array.isArray(state.items) ? state.items.map(normalizeOwnerRecord) : []
  };
}

export async function loadOwners(): Promise<OwnerState> {
  const paths = getWorkspacePaths();
  try {
    return normalizeOwnerState(await readYamlFile<OwnerState>(paths.ownerFile));
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return emptyOwnerState();
    }
    throw error;
  }
}

export async function saveOwners(owners: OwnerState): Promise<void> {
  await withWorkspaceMutationLock(async () => {
    const paths = getWorkspacePaths();
    await writeYamlFile(paths.ownerFile, normalizeOwnerState(owners));
  });
}

function assertOwnerKind(value: string): asserts value is OwnerKind {
  if (!(OWNER_KINDS as readonly string[]).includes(value)) {
    throw new Error(`Unsupported owner kind "${value}". Use ${OWNER_KINDS.join(", ")}.`);
  }
}

function assertOwnerStatus(value: string): asserts value is OwnerStatus {
  if (!(OWNER_STATUSES as readonly string[]).includes(value)) {
    throw new Error(`Unsupported owner status "${value}". Use ${OWNER_STATUSES.join(", ")}.`);
  }
}

export function assertValidOwnerRegistry(owners: OwnerRecord[]): void {
  const ids = new Set<string>();
  const aliases = new Map<string, string>();

  for (const owner of owners.map(normalizeOwnerRecord)) {
    assertControlPlaneId(owner.id, "Owner");
    if (ids.has(owner.id)) {
      throw new Error(`Owner registry contains duplicate owner id ${owner.id}`);
    }
    ids.add(owner.id);

    if (!owner.name.trim()) {
      throw new Error(`Owner ${owner.id} is missing name`);
    }
    assertOwnerKind(owner.kind);
    assertOwnerStatus(owner.status);

    for (const alias of owner.aliases) {
      const normalizedAlias = alias.toLowerCase();
      const existingOwner = aliases.get(normalizedAlias);
      if (existingOwner && existingOwner !== owner.id) {
        throw new Error(`Owner alias "${alias}" is shared by ${existingOwner} and ${owner.id}`);
      }
      aliases.set(normalizedAlias, owner.id);
    }
  }
}

export function assertOwnerRefsExist(input: {
  ownerIds: Set<string>;
  refs: Array<{ source: string; owner: string | null | undefined }>;
}): void {
  for (const ref of input.refs) {
    if (ref.owner && !input.ownerIds.has(ref.owner)) {
      throw new Error(`${ref.source} points to missing owner ${ref.owner}`);
    }
  }
}

function parseAliases(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export async function addOwner(input: {
  id: string;
  name: string;
  kind?: OwnerKind;
  aliases?: string;
}): Promise<{ owner: OwnerRecord; owners: OwnerState }> {
  return withWorkspaceMutationLock(async () => {
    const paths = getWorkspacePaths();
    const owners = await loadOwners();
    const id = input.id.trim();
    const kind = input.kind ?? "agent";
    assertControlPlaneId(id, "Owner");
    assertOwnerKind(kind);

    if (owners.items.some((owner) => owner.id === id)) {
      throw new Error(`Owner "${id}" already exists.`);
    }

    const now = new Date().toISOString();
    const owner: OwnerRecord = {
      id,
      name: input.name,
      kind,
      status: "active",
      aliases: parseAliases(input.aliases),
      createdAt: now,
      updatedAt: now
    };
    const next = {
      items: [...owners.items, owner]
    };
    assertValidOwnerRegistry(next.items);
    await writeYamlFile(paths.ownerFile, next);
    return { owner, owners: next };
  });
}

export async function updateOwner(input: {
  id: string;
  name?: string;
  kind?: OwnerKind;
  status?: OwnerStatus;
  aliases?: string;
  clearAliases?: boolean;
}): Promise<{ owner: OwnerRecord; owners: OwnerState }> {
  return withWorkspaceMutationLock(async () => {
    const paths = getWorkspacePaths();
    const owners = await loadOwners();
    const index = owners.items.findIndex((owner) => owner.id === input.id);

    if (index === -1) {
      throw new Error(`Owner "${input.id}" does not exist.`);
    }
    if (
      !input.name &&
      input.kind === undefined &&
      input.status === undefined &&
      input.aliases === undefined &&
      !input.clearAliases
    ) {
      throw new Error("owner update requires at least one of --name, --kind, --status, --aliases, or --clear-aliases.");
    }
    if (input.kind) {
      assertOwnerKind(input.kind);
    }
    if (input.status) {
      assertOwnerStatus(input.status);
    }

    const current = owners.items[index];
    const nextItems = [...owners.items];
    nextItems[index] = {
      ...current,
      ...(input.name ? { name: input.name } : {}),
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.aliases !== undefined ? { aliases: parseAliases(input.aliases) } : {}),
      ...(input.clearAliases ? { aliases: [] } : {}),
      updatedAt: new Date().toISOString()
    };

    const next = { items: nextItems };
    assertValidOwnerRegistry(next.items);
    await writeYamlFile(paths.ownerFile, next);
    return { owner: nextItems[index], owners: next };
  });
}
