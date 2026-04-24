import { defineI18n } from "fumadocs-core/i18n";
import { defineI18nUI } from "fumadocs-ui/i18n";

export type SiteLocale = "en" | "zh-CN";

const languages: SiteLocale[] = ["en", "zh-CN"];

export const i18n = defineI18n({
  defaultLanguage: "en",
  languages
});

export function isSiteLocale(value: string): value is SiteLocale {
  return languages.includes(value as SiteLocale);
}

export const i18nUI = defineI18nUI(i18n, {
  "zh-CN": {
    displayName: "简体中文",
    search: "搜索文档",
    searchNoResult: "没有找到结果",
    toc: "本页目录",
    tocNoHeadings: "暂无标题",
    lastUpdate: "最近更新",
    chooseLanguage: "选择语言",
    nextPage: "下一页",
    previousPage: "上一页",
    chooseTheme: "切换主题",
    editOnGithub: "在 GitHub 上编辑"
  },
  en: {
    displayName: "English",
    search: "Search documentation",
    searchNoResult: "No results found",
    toc: "On this page",
    tocNoHeadings: "No headings",
    lastUpdate: "Last updated",
    chooseLanguage: "Choose language",
    nextPage: "Next page",
    previousPage: "Previous page",
    chooseTheme: "Choose theme",
    editOnGithub: "Edit on GitHub"
  }
});
