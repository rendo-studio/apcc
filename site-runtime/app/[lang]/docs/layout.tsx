import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { DocsLayout } from "fumadocs-ui/layouts/docs";

import { DocsLiveProvider } from "../../../components/site/docs-live-provider";
import { DocsSidebarFolder, DocsSidebarItem, DocsSidebarSeparator } from "../../../components/site/docs-sidebar";
import { createDocsViewerSource } from "../../../lib/docs-viewer";
import { i18n, isSiteLocale } from "../../../lib/i18n";
import { baseOptions } from "../../../lib/layout.shared";
import {
  loadControlPlaneSnapshot,
  loadDocsViewerData,
  loadRuntimeMetadata,
  loadRuntimeVersion
} from "../../../lib/runtime-data";

export const dynamic = "force-dynamic";

export default async function Layout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isSiteLocale(lang)) {
    notFound();
  }

  const [snapshot, viewerData, runtime, version] = await Promise.all([
    loadControlPlaneSnapshot(),
    loadDocsViewerData(),
    loadRuntimeMetadata(),
    loadRuntimeVersion()
  ]);
  const viewer = createDocsViewerSource(viewerData, lang);

  return (
    <DocsLiveProvider
      enabled={runtime.mode === "live"}
      locale={lang}
      initialVersion={version.updatedAt}
      pages={snapshot.docs.pages.map((entry) => ({
        path: entry.path,
        title: entry.title,
        latestRevisionId: entry.latestRevisionId,
        revisionCount: entry.revisionCount
      }))}
      workspaceStateDigest={snapshot.workspace.stateDigest}
    >
      <DocsLayout
        {...baseOptions(lang)}
        tree={viewer.pageTree}
        sidebar={{
          components: {
            Item: DocsSidebarItem,
            Folder: DocsSidebarFolder,
            Separator: DocsSidebarSeparator
          }
        }}
      >
        {children}
      </DocsLayout>
    </DocsLiveProvider>
  );
}
