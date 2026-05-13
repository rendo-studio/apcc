import { notFound } from "next/navigation";

import { AppHeader } from "../../components/site/app-header";
import { DocsLiveProvider } from "../../components/site/docs-live-provider";
import { HomeOverviewView } from "../../components/site/home-overview-view";
import { getDocsEntryHref } from "../../lib/docs-entry";
import { isSiteLocale } from "../../lib/i18n";
import {
  loadControlPlaneSnapshot,
  loadDocsViewerData,
  loadRuntimeMetadata,
  loadRuntimeVersion
} from "../../lib/runtime-data";

export const dynamic = "force-dynamic";

export default async function LocaleHomePage({
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
      <HomeOverviewView locale={lang} snapshot={snapshot} docsHref={docsHref} />
    </DocsLiveProvider>
  );
}
