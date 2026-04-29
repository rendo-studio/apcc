import { Markdown } from "fumadocs-core/content/md";
import type { ComponentProps } from "react";

import { getMarkdownRendererOptions } from "../../lib/markdown";

export async function RenderedMarkdown({
  components,
  children
}: {
  components?: ComponentProps<typeof Markdown>["components"];
  children: string;
}) {
  const rendererOptions = await getMarkdownRendererOptions();

  return (
    <Markdown components={components} {...rendererOptions}>
      {children}
    </Markdown>
  );
}
