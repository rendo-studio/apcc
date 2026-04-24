import { createI18nSearchAPI } from "fumadocs-core/search/server";
import { createTokenizer } from "@orama/tokenizers/mandarin";

import { createDocsViewerSource } from "../../../lib/docs-viewer";
import { i18n } from "../../../lib/i18n";
import { loadDocsViewerData } from "../../../lib/runtime-data";

const mandarinTokenizer = await createTokenizer();

const api = createI18nSearchAPI("simple", {
  i18n,
  localeMap: {
    "zh-CN": {
      tokenizer: mandarinTokenizer,
      search: {
        threshold: 0,
        tolerance: 0
      }
    },
    en: "english"
  },
  indexes: async () => {
    const viewerData = await loadDocsViewerData();

    return i18n.languages.flatMap((locale) =>
      createDocsViewerSource(viewerData, locale).getPages().map((page) => ({
        locale,
        title: page.title,
        description: page.description,
        content: page.body,
        breadcrumbs: page.slug.slice(0, -1),
        keywords: page.slug.join(" "),
        url: page.url
      }))
    );
  }
});

export const { GET } = api;
