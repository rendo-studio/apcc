import { redirect } from "next/navigation";

import { loadControlPlaneSnapshot } from "../../../lib/runtime-data";

export default async function DocsLocaleRedirectPage({
  params
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const snapshot = await loadControlPlaneSnapshot();
  const locale = snapshot.workspace.docsLanguage;

  if (!slug || slug.length === 0) {
    redirect(`/${locale}`);
  }

  redirect(`/${locale}/docs/${slug.join("/")}`);
}
