import fs from "node:fs/promises";
import path from "node:path";

import { getApccPackageFile } from "./package-runtime.js";
import { readText } from "./storage.js";

export interface GuideTopic {
  topic: string;
  title: string;
  description: string;
  source: "workflow" | "public-doc";
  path: string;
}

export function getWorkflowSkillPackageDir(): string {
  return getApccPackageFile("assets", "skills", "apcc-workflow");
}

export function getWorkflowGuideAssetPath(): string {
  return path.join(getWorkflowSkillPackageDir(), "SKILL.md");
}

export function getPublicGuideDocsPath(): string {
  return getApccPackageFile("docs", "public");
}

function parseFrontmatter(content: string): { frontmatter: { name?: string; description?: string }; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatter: { name?: string; description?: string } = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key === "name" || key === "description") {
      frontmatter[key] = value;
    }
  }

  return {
    frontmatter,
    body: match[2] ?? ""
  };
}

function topicFromFileName(fileName: string): string {
  return fileName.replace(/\.(md|mdx)$/i, "");
}

function titleFromTopic(topic: string): string {
  return topic
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function normalizeTopic(topic: string): string {
  return topic.trim().toLowerCase();
}

export async function loadWorkflowGuide() {
  const assetPath = getWorkflowGuideAssetPath();
  const markdown = await readText(assetPath);
  return {
    title: "APCC Workflow Guide",
    description: "Canonical Agent-first workflow guidance distributed with the CLI.",
    assetPath,
    markdown
  };
}

export async function listPublicGuideTopics(): Promise<GuideTopic[]> {
  const publicDocsPath = getPublicGuideDocsPath();
  const entries = await fs.readdir(publicDocsPath, { withFileTypes: true }).catch(() => []);
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && /\.(md|mdx)$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const topics: GuideTopic[] = [];
  for (const fileName of markdownFiles) {
    const filePath = path.join(publicDocsPath, fileName);
    const markdown = await readText(filePath);
    const { frontmatter } = parseFrontmatter(markdown);
    const topic = topicFromFileName(fileName);
    topics.push({
      topic,
      title: frontmatter.name || titleFromTopic(topic),
      description: frontmatter.description || "",
      source: "public-doc",
      path: filePath
    });
  }

  return topics;
}

export async function listGuideTopics(): Promise<GuideTopic[]> {
  return [
    {
      topic: "workflow",
      title: "APCC Workflow Guide",
      description: "Agent-first workflow guidance sourced from the canonical APCC workflow skill package.",
      source: "workflow",
      path: getWorkflowGuideAssetPath()
    },
    ...(await listPublicGuideTopics())
  ];
}

function renderGuideIndex(topics: GuideTopic[]): string {
  const topicLines = topics.map((topic) => {
    const description = topic.description ? ` - ${topic.description}` : "";
    return `- \`${topic.topic}\`: ${topic.title}${description}`;
  });

  return [
    "# APCC Guide",
    "",
    "Use `apcc guide <topic>` to read a bundled APCC guide topic.",
    "",
    "## Topics",
    "",
    ...topicLines,
    "",
    "## Examples",
    "",
    "```bash",
    "apcc guide workflow",
    "apcc guide <topic>",
    "```",
    ""
  ].join("\n");
}

export async function loadGuide(topic?: string) {
  const normalizedTopic = topic ? normalizeTopic(topic) : "";

  if (!normalizedTopic) {
    return {
      title: "APCC Guide",
      description: "Bundled APCC public guide topic index.",
      topic: null,
      topics: await listGuideTopics(),
      markdown: renderGuideIndex(await listGuideTopics())
    };
  }

  if (normalizedTopic === "workflow") {
    return {
      ...(await loadWorkflowGuide()),
      topic: "workflow"
    };
  }

  if (normalizedTopic.includes("/") || normalizedTopic.includes("\\") || normalizedTopic === "." || normalizedTopic === "..") {
    throw new Error("guide topic must be a bundled public docs topic name.");
  }

  const publicTopics = await listPublicGuideTopics();
  const selected = publicTopics.find((candidate) => candidate.topic === normalizedTopic);
  if (!selected) {
    const available = (await listGuideTopics()).map((candidate) => candidate.topic).join(", ");
    throw new Error(`Unknown guide topic "${topic}". Available topics: ${available}.`);
  }

  return {
    title: selected.title,
    description: selected.description,
    assetPath: selected.path,
    topic: selected.topic,
    markdown: await readText(selected.path)
  };
}
