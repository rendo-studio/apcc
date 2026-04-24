import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { RootProvider } from "fumadocs-ui/provider/next";

import { i18nUI, isSiteLocale } from "../../lib/i18n";

export default async function LocaleLayout({
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

  return (
    <RootProvider
      i18n={i18nUI.provider(lang)}
      theme={{
        enabled: false
      }}
      search={{
        options: {
          api: "/api/search"
        }
      }}
    >
      {children}
    </RootProvider>
  );
}
