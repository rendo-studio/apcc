import type { SiteLocale } from "./i18n";

function normalizeDocsPath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/");
}

export function docsPathToSlug(relativePath: string): string[] {
  const normalized = normalizeDocsPath(relativePath);
  const parts = normalized.split("/");
  const fileName = parts.at(-1) ?? "";
  const extensionIndex = fileName.lastIndexOf(".");
  const baseName = extensionIndex === -1 ? fileName : fileName.slice(0, extensionIndex);

  if (baseName === "index") {
    return parts.slice(0, -1);
  }

  return [...parts.slice(0, -1), baseName];
}

export function decodeRouteSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function decodeRouteSlug(slug: string[] | undefined): string[] {
  return (slug ?? []).map((segment) => decodeRouteSegment(segment));
}

export function docsSlugToUrl(locale: SiteLocale, slug: string[]): string {
  const encodedPath = slug.map((segment) => encodeURIComponent(segment)).join("/");
  return encodedPath.length > 0 ? `/${locale}/docs/${encodedPath}` : `/${locale}/docs`;
}

export function docsPathToHref(locale: SiteLocale, docPath: string): string {
  return docsSlugToUrl(locale, docsPathToSlug(docPath));
}
