import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { AppHeader } from "../components/site/app-header";
import { DocsNavTitle } from "../components/site/docs-nav-title";
import type { SiteLocale } from "./i18n";

function sidebarHomeLabel(locale: SiteLocale) {
  return locale === "zh-CN" ? "返回首页" : "Back Home";
}

export function baseOptions(
  locale: SiteLocale,
  docsHref = `/${locale}/docs/console`,
  includeHeader = true
): BaseLayoutProps {
  return {
    slots: includeHeader
      ? undefined
      : {
          navTitle: DocsNavTitle
        },
    nav: includeHeader
      ? {
          title: "APCC",
          url: `/${locale}`,
          component: <AppHeader locale={locale} docsHref={docsHref} />
        }
      : {
          enabled: false,
          title: sidebarHomeLabel(locale),
          url: `/${locale}`
        },
    i18n: true
  };
}
