import { notFound, redirect } from "next/navigation";

import { AppHeader } from "../../../../../../components/site/app-header";
import { ConsoleDetailView } from "../../../../../../components/site/console-detail-view";
import { DocsLiveProvider } from "../../../../../../components/site/docs-live-provider";
import { getDocsEntryHref } from "../../../../../../lib/docs-entry";
import { isConsoleSection } from "../../../../../../lib/console-routes";
import { isSiteLocale } from "../../../../../../lib/i18n";
import {
  loadControlPlaneSnapshot,
  loadDocsViewerData,
  loadRuntimeMetadata,
  loadRuntimeVersion
} from "../../../../../../lib/runtime-data";

export const dynamic = "force-dynamic";

export default async function ConsoleSectionPage({
  params
}: {
  params: Promise<{ lang: string; section: string }>;
}) {
  const { lang, section } = await params;
  if (!isSiteLocale(lang)) {
    notFound();
  }

  if (section === "tasks") {
    redirect(`/${lang}/docs/console/plans`);
  }

  if (!isConsoleSection(section)) {
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
      <ConsoleDetailView locale={lang} snapshot={snapshot} section={section} />
    </DocsLiveProvider>
  );
}
