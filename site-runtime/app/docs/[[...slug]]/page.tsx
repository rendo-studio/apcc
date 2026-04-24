import { redirect } from "next/navigation";

import { loadControlPlaneSnapshot } from "../../../lib/runtime-data";

export default async function DocsLocaleRedirectPage({
  params
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const suffix = slug && slug.length > 0 ? `/${slug.join("/")}` : "";
  const snapshot = await loadControlPlaneSnapshot();
  const locale = snapshot.workspace.docsLanguage;

  redirect(`/${locale}/docs${suffix}`);
}
