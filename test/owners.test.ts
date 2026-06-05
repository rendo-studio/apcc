import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { addOwner, loadOwners, updateOwner } from "../src/core/owners.js";
import { createWorkspaceFixture } from "./helpers/workspace.js";

const restorers: Array<() => void> = [];
const cleanups: Array<() => Promise<void>> = [];
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runOwnerCli(args: string[], workspaceRoot: string) {
  const result = spawnSync(process.execPath, ["--import", "tsx", path.join(repoRoot, "src", "bin", "apcc.ts"), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      APCC_WORKSPACE_ROOT: workspaceRoot
    }
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

afterEach(async () => {
  while (restorers.length > 0) {
    restorers.pop()?.();
  }

  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("owner registry", () => {
  it("adds, lists, and updates workspace owners", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const added = await addOwner({
      id: "codex-main",
      name: "Codex Main",
      kind: "agent",
      aliases: "codex,main-agent"
    });
    const updated = await updateOwner({
      id: "codex-main",
      status: "inactive"
    });
    const owners = await loadOwners();

    expect(added.owner.status).toBe("active");
    expect(updated.owner.status).toBe("inactive");
    expect(owners.items[0]).toMatchObject({
      id: "codex-main",
      kind: "agent",
      aliases: ["codex", "main-agent"]
    });
  });

  it("renders owner list through the CLI and rejects duplicate aliases", async () => {
    const fixture = await createWorkspaceFixture();
    restorers.push(fixture.use());
    cleanups.push(fixture.cleanup);

    const added = runOwnerCli(
      ["owner", "add", "--id", "codex-main", "--name", "Codex Main", "--kind", "agent", "--aliases", "codex"],
      fixture.root
    );
    const listed = runOwnerCli(["owner", "list"], fixture.root);
    const duplicateAlias = runOwnerCli(
      ["owner", "add", "--id", "codex-helper", "--name", "Codex Helper", "--kind", "agent", "--aliases", "codex"],
      fixture.root
    );

    expect(added.status).toBe(0);
    expect(listed.status).toBe(0);
    expect(listed.stdout).toContain("# Owners");
    expect(listed.stdout).toContain("`codex-main` | active | agent | Codex Main | aliases: codex");
    expect(duplicateAlias.status).not.toBe(0);
    expect(duplicateAlias.stderr).toContain("Owner alias");
  });
});
