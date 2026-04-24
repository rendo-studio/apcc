import type * as PageTree from "fumadocs-core/page-tree";
import type { TOCItemType } from "fumadocs-core/toc";

import type {
  RuntimeDocsViewerData,
  RuntimeDocsViewerPage,
  RuntimeDocsViewerTreeNode
} from "./runtime-data";
import type { SiteLocale } from "./i18n";

export interface DocsViewerPage {
  path: string;
  slug: string[];
  slugs: string[];
  url: string;
  title: string;
  description: string;
  body: string;
  data: {
    title: string;
    description: string;
    toc: TOCItemType[];
    full: boolean;
  };
}

export interface DocsViewerSource {
  pageTree: PageTree.Root;
  getPages(): DocsViewerPage[];
  getPage(slug: string[]): DocsViewerPage | undefined;
  generateParams(): Array<{ slug: string[] }>;
}

function docsPathToSlug(relativePath: string): string[] {
  const normalized = relativePath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  const fileName = parts.at(-1) ?? "";
  const extensionIndex = fileName.lastIndexOf(".");
  const baseName = extensionIndex === -1 ? fileName : fileName.slice(0, extensionIndex);

  if (baseName === "index") {
    return parts.slice(0, -1);
  }

  return [...parts.slice(0, -1), baseName];
}

function docsSlugToUrl(locale: SiteLocale, slug: string[]): string {
  return slug.length === 0 ? `/${locale}/docs` : `/${locale}/docs/${slug.join("/")}`;
}

function headingsToToc(headings: RuntimeDocsViewerPage["headings"]): TOCItemType[] {
  return headings.map((heading) => ({
    title: heading.text,
    url: `#${heading.id}`,
    depth: heading.depth
  }));
}

function buildPage(page: RuntimeDocsViewerPage, locale: SiteLocale): DocsViewerPage {
  return {
    path: page.path,
    slug: page.slug,
    slugs: page.slug,
    url: docsSlugToUrl(locale, page.slug),
    title: page.title,
    description: page.description,
    body: page.body,
    data: {
      title: page.title,
      description: page.description,
      toc: headingsToToc(page.headings),
      full: false
    }
  };
}

function buildTreeNode(node: RuntimeDocsViewerTreeNode, locale: SiteLocale): PageTree.Node {
  if (node.type === "page") {
    return {
      type: "page",
      name: node.title,
      url: docsSlugToUrl(locale, node.slug)
    };
  }

  return {
    type: "folder",
    name: node.title,
    defaultOpen: true,
    children: node.children.map((child) => buildTreeNode(child, locale))
  };
}

export function createDocsViewerSource(data: RuntimeDocsViewerData, locale: SiteLocale): DocsViewerSource {
  const pages = data.pages.map((page) => buildPage(page, locale));
  const pagesBySlug = new Map(pages.map((page) => [page.slug.join("/"), page]));
  const pageTree: PageTree.Root = {
    type: "root",
    name: "APCC",
    children: data.navigation.map((node) => buildTreeNode(node, locale))
  };

  return {
    pageTree,
    getPages() {
      return pages;
    },
    getPage(slug: string[]) {
      return pagesBySlug.get(slug.join("/"));
    },
    generateParams() {
      return pages.map((page) => ({ slug: page.slug }));
    }
  };
}

export function resolveDocsHref(locale: SiteLocale, currentPath: string, href: string): string {
  if (!href || href.startsWith("#") || href.startsWith("/")) {
    return href;
  }

  if (/^[a-z]+:/i.test(href) || href.startsWith("//")) {
    return href;
  }

  const [pathname, hash = ""] = href.split("#");
  const normalizedCurrent = currentPath.replace(/\\/g, "/");
  const currentSegments = normalizedCurrent.split("/");
  currentSegments.pop();

  const resolvedSegments = pathname
    .replace(/\\/g, "/")
    .split("/")
    .reduce<string[]>((segments, part) => {
      if (part === "" || part === ".") {
        return segments;
      }
      if (part === "..") {
        if (segments.length > 0) {
          segments.pop();
        }
        return segments;
      }

      segments.push(part);
      return segments;
    }, [...currentSegments]);

  const resolvedPath = resolvedSegments.join("/");
  const resolvedSlug = docsPathToSlug(resolvedPath);
  const url = docsSlugToUrl(locale, resolvedSlug);

  return hash ? `${url}#${hash}` : url;
}
