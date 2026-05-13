import { notFound } from "next/navigation";

import { AppHeader } from "../../../../../components/site/app-header";
import { ConsoleOverviewView } from "../../../../../components/site/console-overview-view";
import { DocsLiveProvider } from "../../../../../components/site/docs-live-provider";
import { getDocsEntryHref } from "../../../../../lib/docs-entry";
import { isSiteLocale } from "../../../../../lib/i18n";
import {
  loadControlPlaneSnapshot,
  loadDocsViewerData,
  loadRuntimeMetadata,
  loadRuntimeVersion
} from "../../../../../lib/runtime-data";

export const dynamic = "force-dynamic";

export default async function ConsolePage({
  params
}: {
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
  const docsHref = getDocsEntryHref(lang, viewerData.navigation);

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
      <AppHeader locale={lang} docsHref={docsHref} />
      <ConsoleOverviewView locale={lang} snapshot={snapshot} />
    </DocsLiveProvider>
  );
}
