import { notFound, redirect } from "next/navigation";

import { isSiteLocale } from "../../lib/i18n";

export default async function LocaleHomePage({
  params
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isSiteLocale(lang)) {
    notFound();
  }

  redirect(`/${lang}/docs/console`);
}
