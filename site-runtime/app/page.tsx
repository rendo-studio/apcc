import { redirect } from "next/navigation";

import { i18n, isSiteLocale } from "../lib/i18n";
import { loadControlPlaneSnapshot } from "../lib/runtime-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const snapshot = await loadControlPlaneSnapshot();
  const docsLanguage = snapshot.workspace.docsLanguage;
  const locale = isSiteLocale(docsLanguage) ? docsLanguage : i18n.defaultLanguage;
  redirect(`/${locale}/docs/console`);
}
