import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Markdown } from "fumadocs-core/content/md";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { DocsBody, DocsPage } from "fumadocs-ui/layouts/docs/page";
import type { ComponentProps } from "react";

import { ConsoleOverviewView } from "../../../../components/site/console-overview-view";
import { ConsoleTasksView } from "../../../../components/site/console-tasks-view";
import { DocumentCompareView, DocumentRevisionPreview } from "../../../../components/site/document-compare-view";
import { DocumentRevisionSidebar } from "../../../../components/site/document-revision-bar";
import { createDocsViewerSource, resolveDocsHref } from "../../../../lib/docs-viewer";
import { decodeRouteSlug, docsSlugToUrl } from "../../../../lib/docs-path";
import { i18n, isSiteLocale, type SiteLocale } from "../../../../lib/i18n";
import { loadControlPlaneSnapshot, loadDocsRevisionState, loadDocsViewerData } from "../../../../lib/runtime-data";

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
  const useOverviewConsole = key === "console";
  const usePlansConsole = key === "console/plans";
  const useConsoleView = useOverviewConsole || usePlansConsole;
  const [snapshot, viewerData] = await Promise.all([loadControlPlaneSnapshot(), loadDocsViewerData()]);
  const viewer = createDocsViewerSource(viewerData, lang);
  const page = viewer.getPage(resolvedSlug);
  const currentDocPath = useConsoleView ? null : page?.path ?? null;
  const revisionState = currentDocPath ? await loadDocsRevisionState() : null;
  const revisionRecord = currentDocPath
    ? revisionState?.items.find((entry) => entry.path === currentDocPath) ?? null
    : null;
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

  if (key === "console/overview") {
    redirect(`/${lang}/docs/console`);
  }

  if (key === "console/tasks") {
    redirect(`/${lang}/docs/console/plans`);
  }

  if (!useConsoleView && key === "") {
    redirect(`/${lang}/docs/console/plans`);
  }

  if (!useConsoleView && !page) {
    notFound();
  }

  const resolvedPage = useConsoleView ? null : page ?? null;
  const components = resolvedPage ? createMarkdownComponents(lang, resolvedPage.path) : defaultMdxComponents;

  return (
    <DocsPage
      toc={useConsoleView ? undefined : resolvedPage?.data.toc}
      full={useConsoleView ? true : resolvedPage?.data.full ?? false}
      tableOfContent={
        useConsoleView || !revisionRecord
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
        {useConsoleView ? (
          useOverviewConsole ? (
            <ConsoleOverviewView locale={lang} snapshot={snapshot} />
          ) : (
            <ConsoleTasksView locale={lang} snapshot={snapshot} />
          )
        ) : (
          <>
            {effectiveComparedRevision && latestRevision ? (
              <DocumentCompareView locale={lang} previous={effectiveComparedRevision} current={latestRevision} />
            ) : effectiveSelectedRevision ? (
              <DocumentRevisionPreview locale={lang} revision={effectiveSelectedRevision} components={components} />
            ) : resolvedPage ? (
              <Markdown components={components}>{resolvedPage.body}</Markdown>
            ) : null}
          </>
        )}
      </DocsBody>
    </DocsPage>
  );
}
