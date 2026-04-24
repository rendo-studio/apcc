import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import type { SiteLocale } from "./i18n";

export function baseOptions(locale: SiteLocale): BaseLayoutProps {
  return {
    nav: {
      title: "APCC",
      url: `/${locale}/docs`
    },
    i18n: true
  };
}
