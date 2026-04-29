import type { MarkdownRendererOptions } from "fumadocs-core/content/md";
import { rehypeCode } from "fumadocs-core/mdx-plugins/rehype-code";
import { remarkGfm } from "fumadocs-core/mdx-plugins/remark-gfm";
import { remarkHeading } from "fumadocs-core/mdx-plugins/remark-heading";
import { cache } from "react";

type RuntimeMarkdownRendererOptions = Pick<MarkdownRendererOptions, "remarkPlugins" | "rehypePlugins">;

export const getMarkdownRendererOptions = cache(async (): Promise<RuntimeMarkdownRendererOptions> => ({
  remarkPlugins: [[remarkGfm], [remarkHeading, { generateToc: false }]],
  rehypePlugins: [[rehypeCode]]
}));
