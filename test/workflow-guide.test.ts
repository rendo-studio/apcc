import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

import {
  getPublicGuideDocsPath,
  getWorkflowGuideAssetPath,
  getWorkflowSkillPackageDir,
  listPublicGuideTopics,
  loadGuide,
  loadWorkflowGuide
} from "../src/core/workflow-guide.js";

describe("workflow guide", () => {
  it("loads the authoritative APCC workflow guide from the bundled CLI asset path", async () => {
    const guide = await loadWorkflowGuide();

    expect(getWorkflowGuideAssetPath()).toContain("assets");
    expect(getWorkflowGuideAssetPath()).toBe(path.join(getWorkflowSkillPackageDir(), "SKILL.md"));
    expect(guide.title).toBe("APCC Workflow Guide");
    expect(guide.markdown).toContain("# APCC Workflow Guide");
    expect(guide.markdown).toContain("Prefer `apcc guide workflow` as the primary explicit way to read it");
    expect(guide.markdown).toContain("npm install -g apcc");
    expect(guide.markdown).toContain("apcc guide workflow");
    expect(guide.markdown).toContain("## Operating States");
    expect(guide.markdown).toContain("### Cold Round");
    expect(guide.markdown).toContain("### Warm Continuation");
    expect(guide.markdown).toContain("### Desync Suspicion");
    expect(guide.markdown).toContain("## Goal-Driven Development");
    expect(guide.markdown).toContain("do not silently substitute a one-line feature request for a project definition");
    expect(guide.markdown).toContain("## Cold Round Start");
    expect(guide.markdown).toContain("apcc site start");
    expect(guide.markdown).toContain("do not rerun `site start` or `status` by default");
    expect(guide.markdown).toContain("## Inspect Only If Needed");
    expect(guide.markdown).toContain("## Refresh The Workspace First");
    expect(guide.markdown).toContain("apcc init");
    expect(guide.markdown).toContain('apcc project set --name "Example Project"');
    expect(guide.markdown).not.toContain("apcc diff");
  });

  it("lists public guide topics from docs/public without hardcoded topic registration", async () => {
    const publicDocsPath = getPublicGuideDocsPath();
    const expectedTopics = (await fs.readdir(publicDocsPath))
      .filter((fileName) => /\.(md|mdx)$/i.test(fileName))
      .map((fileName) => fileName.replace(/\.(md|mdx)$/i, ""))
      .sort((a, b) => a.localeCompare(b));

    const publicTopics = await listPublicGuideTopics();

    expect(publicTopics.map((topic) => topic.topic)).toEqual(expectedTopics);
    for (const topic of publicTopics) {
      expect(topic.path).toBe(path.join(publicDocsPath, `${topic.topic}.md`));
      expect(topic.source).toBe("public-doc");
    }
  });

  it("renders a dynamic guide index and public docs topics", async () => {
    const index = await loadGuide();
    const publicTopic = (await listPublicGuideTopics())[0];

    expect(index.markdown).toContain("# APCC Guide");
    expect(index.markdown).toContain("`workflow`");
    expect(index.markdown).toContain(`\`${publicTopic.topic}\``);

    const topicGuide = await loadGuide(publicTopic.topic);
    expect(topicGuide.title).toBe(publicTopic.title);
    expect(topicGuide.markdown).toContain(`# ${publicTopic.title}`);
  });

  it("keeps workflow as the only reserved non-public guide topic", async () => {
    const workflow = await loadGuide("workflow");

    expect(workflow.topic).toBe("workflow");
    expect(workflow.markdown).toContain("# APCC Workflow Guide");
  });
});
