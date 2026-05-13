import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Markdown } from "fumadocs-core/content/md";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { DocsBody, DocsPage } from "fumadocs-ui/layouts/docs/page";
import type { ComponentProps } from "react";

import { DocArticleMeta } from "../../../../../components/site/doc-article-meta";
import { DocumentCompareView, DocumentRevisionPreview } from "../../../../../components/site/document-compare-view";
import { DocumentRevisionSidebar } from "../../../../../components/site/document-revision-bar";
import { RenderedMarkdown } from "../../../../../components/site/rendered-markdown";
import { createDocsViewerSource, resolveDocsHref } from "../../../../../lib/docs-viewer";
import { decodeRouteSlug, docsSlugToUrl } from "../../../../../lib/docs-path";
import { isSiteLocale, type SiteLocale } from "../../../../../lib/i18n";
import { loadDocsRevisionState, loadDocsViewerData } from "../../../../../lib/runtime-data";

export const dynamic = "force-dynamic";

function createMarkdownComponents(
  locale: SiteLocale,
  currentPath: string
): ComponentProps<typeof Markdown>["components"] {
  return {
    ...defaultMdxComponents,
    a: ({ href, children, ...props }) => {
      const resolvedHref = typeof href === "string" ? resolveDocsHref(locale, currentPath, href) : href;

      if (typeof resolvedHref !== "string") {
        return (
          <a href={resolvedHref} {...props}>
            {children}
          </a>
        );
      }

      if (
        resolvedHref.startsWith("#") ||
        /^[a-z]+:/i.test(resolvedHref) ||
        resolvedHref.startsWith("//")
      ) {
        return (
          <a href={resolvedHref} {...props}>
            {children}
          </a>
        );
      }

      return (
        <Link href={resolvedHref} {...props}>
          {children}
        </Link>
      );
    }
  };
}

export default async function Page(props: {
  params: Promise<{ lang: string; slug?: string[] }>;
  searchParams: Promise<{ compare?: string; revision?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { lang } = params;
  if (!isSiteLocale(lang)) {
    notFound();
  }

  const resolvedSlug = decodeRouteSlug(params.slug);
  const key = resolvedSlug.join("/");

  if (key === "console/overview" || key === "console/tasks" || key === "console/plans" || key === "") {
    redirect(`/${lang}/docs/console`);
  }

  const viewerData = await loadDocsViewerData();
  const viewer = createDocsViewerSource(viewerData, lang);
  const page = viewer.getPage(resolvedSlug);

  if (!page) {
    notFound();
  }

  const revisionState = await loadDocsRevisionState();
  const revisionRecord = revisionState.items.find((entry) => entry.path === page.path) ?? null;
  const latestRevision = revisionRecord?.revisions.at(-1) ?? null;
  const requestedRevisionId = searchParams.revision ?? null;
  const compareRevisionId = searchParams.compare ?? null;
  const selectedRevision =
    revisionRecord && requestedRevisionId
      ? revisionRecord.revisions.find((entry) => entry.id === requestedRevisionId) ?? null
      : null;
  const comparedRevision =
    revisionRecord && compareRevisionId
      ? revisionRecord.revisions.find((entry) => entry.id === compareRevisionId) ?? null
      : null;
  const effectiveSelectedRevision =
    selectedRevision && selectedRevision.id !== latestRevision?.id ? selectedRevision : null;
  const effectiveComparedRevision =
    comparedRevision && comparedRevision.id !== latestRevision?.id ? comparedRevision : null;
  const pathname = docsSlugToUrl(lang, resolvedSlug);
  const components = createMarkdownComponents(lang, page.path);

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full ?? false}
      breadcrumb={{
        enabled: false
      }}
      tableOfContent={
        !revisionRecord
          ? undefined
          : {
              footer: (
                <DocumentRevisionSidebar
                  locale={lang}
                  pathname={pathname}
                  record={revisionRecord}
                  activeRevisionId={effectiveSelectedRevision?.id ?? null}
                  compareRevisionId={effectiveComparedRevision?.id ?? null}
                />
              )
            }
      }
    >
      <DocsBody>
        <>
          <DocArticleMeta
            locale={lang}
            slug={page.slug}
            title={page.title}
            updatedAt={latestRevision?.createdAt ?? revisionRecord?.updatedAt ?? null}
            revisionRecord={revisionRecord}
          />
          {effectiveComparedRevision && latestRevision ? (
            <DocumentCompareView locale={lang} previous={effectiveComparedRevision} current={latestRevision} />
          ) : effectiveSelectedRevision ? (
            <DocumentRevisionPreview locale={lang} revision={effectiveSelectedRevision} components={components} />
          ) : (
            <RenderedMarkdown components={components}>{page.body}</RenderedMarkdown>
          )}
        </>
      </DocsBody>
    </DocsPage>
  );
}
