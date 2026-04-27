import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { export_skills } from "@rendo-studio/aclip";

import { createApp } from "../src/cli/app.js";
import { getWorkflowGuideAssetPath, getWorkflowSkillPackageDir } from "../src/core/workflow-guide.js";

const cleanups: string[] = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const target = cleanups.pop();
    if (target) {
      await fs.rm(target, { recursive: true, force: true });
    }
  }
});

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n?/u, "").trim();
}

describe("skill export hooks", () => {
  it("exports the canonical workflow skill package through ACLIP CLI-level skill hooks", async () => {
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "apcc-skill-export-"));
    cleanups.push(outDir);

    const packageJson = JSON.parse(await fs.readFile(new URL("../package.json", import.meta.url), "utf8")) as {
      version?: string;
    };
    const artifact = await export_skills(createApp(), { outDir });
    const sourceMarkdown = await fs.readFile(getWorkflowGuideAssetPath(), "utf8");
    const exportedPackageDir = path.join(outDir, "apcc-workflow");
    const exportedMarkdown = await fs.readFile(path.join(exportedPackageDir, "SKILL.md"), "utf8");
    const index = JSON.parse(await fs.readFile(path.join(outDir, "skills.aclip.json"), "utf8")) as {
      packages: Array<{ name: string; kind: string; path: string }>;
    };

    expect(artifact.packages).toHaveLength(1);
    expect(artifact.packages[0]).toEqual(
      expect.objectContaining({
        name: "apcc-workflow",
        kind: "cli",
        sourceDir: getWorkflowSkillPackageDir(),
        outputDir: exportedPackageDir
      })
    );
    expect(index.packages).toEqual([
      expect.objectContaining({
        name: "apcc-workflow",
        kind: "cli",
        path: "apcc-workflow"
      })
    ]);
    expect(exportedMarkdown).toContain("name: apcc-workflow");
    expect(exportedMarkdown).toContain("description: Canonical Agent-first workflow guidance for operating an APCC workspace.");
    expect(exportedMarkdown).toContain("aclip-cli-name: apcc");
    expect(exportedMarkdown).toContain(`aclip-cli-version: ${packageJson.version ?? "0.1.0"}`);
    expect(exportedMarkdown).toContain("aclip-doctor-group: doctor");
    expect(stripFrontmatter(exportedMarkdown)).toBe(stripFrontmatter(sourceMarkdown));
  });
});
