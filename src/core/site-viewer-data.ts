import fs from "node:fs/promises";
import path from "node:path";

import { readText } from "./storage.js";
import { docsPathToSlug } from "./site-data.js";

interface FrontmatterShape {
  name?: string;
  title?: string;
  description?: string;
}

interface MetaShape {
  title?: string;
  pages?: string[];
}

export interface SiteViewerHeading {
  depth: number;
  text: string;
  id: string;
}

export interface SiteViewerPagePayload {
  path: string;
  slug: string[];
  title: string;
  description: string;
  body: string;
  headings: SiteViewerHeading[];
}

export interface SiteViewerTreePageNode {
  type: "page";
  title: string;
  path: string;
  slug: string[];
}

export interface SiteViewerTreeFolderNode {
  type: "folder";
  title: string;
  children: SiteViewerTreeNode[];
}

export type SiteViewerTreeNode = SiteViewerTreePageNode | SiteViewerTreeFolderNode;

export interface SiteViewerData {
  generatedAt: string;
  navigation: SiteViewerTreeNode[];
  pages: SiteViewerPagePayload[];
}

function parseFrontmatter(content: string): { frontmatter: FrontmatterShape; body: string } {
  const normalized = content.replace(/^\uFEFF/, "");
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: normalized };
  }

  const frontmatter: FrontmatterShape = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key === "name" || key === "title" || key === "description") {
      frontmatter[key] = value;
    }
  }

  return {
    frontmatter,
    body: match[2] ?? ""
  };
}

function extractHeadings(body: string): SiteViewerHeading[] {
  const headings: SiteViewerHeading[] = [];
  let autoIndex = 0;

  for (const match of body.matchAll(/^(#{1,6})\s+(.+)$/gm)) {
    const depth = match[1].length;
    const text = match[2].trim();
    const id = text
      .normalize("NFKC")
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase();

    headings.push({
      depth,
      text,
      id: id.length > 0 ? id : `section-${++autoIndex}`
    });
  }

  return headings;
}

function displayNameFromSegment(segment: string): string {
  return segment
    .replace(/\.(md|mdx)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (value) => value.toUpperCase());
}

async function readMeta(dirPath: string): Promise<MetaShape> {
  try {
    return JSON.parse(await readText(path.join(dirPath, "meta.json"))) as MetaShape;
  } catch {
    return {};
  }
}

async function collectMarkdownFiles(root: string, base = root): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(fullPath, base)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (extension === ".md" || extension === ".mdx") {
      files.push(path.relative(base, fullPath).replace(/\\/g, "/"));
    }
  }

  return files.sort();
}

async function buildPagePayloads(docsRoot: string): Promise<SiteViewerPagePayload[]> {
  const files = await collectMarkdownFiles(docsRoot);
  const pages: SiteViewerPagePayload[] = [];

  for (const relativePath of files) {
    const content = await readText(path.join(docsRoot, relativePath));
    const { frontmatter, body } = parseFrontmatter(content);
    const title =
      frontmatter.name ??
      frontmatter.title ??
      body.match(/^#\s+(.+)$/m)?.[1]?.trim() ??
      displayNameFromSegment(path.basename(relativePath));

    pages.push({
      path: relativePath,
      slug: docsPathToSlug(relativePath),
      title,
      description: frontmatter.description ?? "",
      body,
      headings: extractHeadings(body)
    });
  }

  return pages;
}

async function buildTreeForDirectory(
  docsRoot: string,
  relativeDir: string,
  pagesByPath: Map<string, SiteViewerPagePayload>
): Promise<SiteViewerTreeNode[]> {
  const absoluteDir = path.join(docsRoot, relativeDir);
  const meta = await readMeta(absoluteDir);
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  const pageNames = new Map<string, string>();
  const folderNames = new Set<string>();

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    if (entry.isDirectory()) {
      folderNames.add(entry.name);
      continue;
    }

    if (!entry.isFile() || ![".md", ".mdx"].includes(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    const baseName = path.basename(entry.name, path.extname(entry.name));
    pageNames.set(baseName, entry.name);
  }

  const orderedNames = Array.isArray(meta.pages) ? [...meta.pages] : [];
  const remainingNames = [
    ...folderNames.values(),
    ...pageNames.keys()
  ].filter((name, index, values) => values.indexOf(name) === index && !orderedNames.includes(name));

  const finalOrder = [...orderedNames, ...remainingNames.sort((left, right) => left.localeCompare(right))];
  const nodes: SiteViewerTreeNode[] = [];

  for (const name of finalOrder) {
    if (pageNames.has(name)) {
      const fileName = pageNames.get(name)!;
      const relativePath = path.join(relativeDir, fileName).replace(/\\/g, "/");
      const page = pagesByPath.get(relativePath);
      if (!page) {
        continue;
      }

      nodes.push({
        type: "page",
        title: page.title,
        path: page.path,
        slug: page.slug
      });
      continue;
    }

    if (folderNames.has(name)) {
      const childRelativeDir = path.join(relativeDir, name);
      const childMeta = await readMeta(path.join(docsRoot, childRelativeDir));
      const children = await buildTreeForDirectory(docsRoot, childRelativeDir, pagesByPath);

      nodes.push({
        type: "folder",
        title: childMeta.title ?? displayNameFromSegment(name),
        children
      });
    }
  }

  return nodes;
}

export async function buildSiteViewerData(docsRoot: string): Promise<SiteViewerData> {
  const pages = await buildPagePayloads(docsRoot);
  const pagesByPath = new Map(pages.map((page) => [page.path, page]));
  const navigation = await buildTreeForDirectory(docsRoot, "", pagesByPath);

  return {
    generatedAt: new Date().toISOString(),
    navigation,
    pages
  };
}
