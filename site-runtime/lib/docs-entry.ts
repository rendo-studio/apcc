import type { SiteLocale } from "./i18n";
import { docsSlugToUrl } from "./docs-path";
import type { RuntimeDocsViewerTreeNode } from "./runtime-data";

function isConsoleSlug(slug: string[]): boolean {
  return slug[0] === "console";
}

function findFirstDocSlug(nodes: RuntimeDocsViewerTreeNode[]): string[] | null {
  for (const node of nodes) {
    if (node.type === "page") {
      if (!isConsoleSlug(node.slug)) {
        return node.slug;
      }
      continue;
    }

    const child = findFirstDocSlug(node.children);
    if (child) {
      return child;
    }
  }

  return null;
}

export function getDocsEntryHref(locale: SiteLocale, navigation: RuntimeDocsViewerTreeNode[]): string {
  const slug = findFirstDocSlug(navigation);
  return slug ? docsSlugToUrl(locale, slug) : `/${locale}/docs/console`;
}
