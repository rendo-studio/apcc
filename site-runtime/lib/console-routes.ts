import type { SiteLocale } from "./i18n";

export const consoleSections = ["plans", "blockers", "changes", "decisions", "versions"] as const;

export type ConsoleSection = (typeof consoleSections)[number];

export function isConsoleSection(value: string): value is ConsoleSection {
  return consoleSections.includes(value as ConsoleSection);
}

export function consoleHref(locale: SiteLocale): string {
  return `/${locale}/docs/console`;
}

export function consoleSectionHref(locale: SiteLocale, section: ConsoleSection): string {
  return `${consoleHref(locale)}/${section}`;
}
