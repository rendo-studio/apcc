import { evaluate } from "@mdx-js/mdx";
import { Markdown } from "fumadocs-core/content/md";
import { Accordions, Accordion } from "fumadocs-ui/components/accordion";
import { File, Files, Folder } from "fumadocs-ui/components/files";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { cache } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import type { ComponentProps } from "react";

import { getMarkdownRendererOptions } from "../../lib/markdown";

type RuntimeMdxComponents = NonNullable<ComponentProps<typeof Markdown>["components"]>;

const runtimeMdxComponents = {
  ...defaultMdxComponents,
  Accordion,
  Accordions,
  File,
  Files,
  Folder,
  Step,
  Steps,
  Tab,
  Tabs
} satisfies RuntimeMdxComponents;

function normalizeRuntimeMdx(source: string): string {
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  const normalized: string[] = [];
  let fence: string | null = null;
  let skippingModuleStatement = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(```+|~~~+)/);

    if (!skippingModuleStatement && fenceMatch) {
      const marker = fenceMatch[1][0];
      fence = fence === marker ? null : marker;
      normalized.push(line);
      continue;
    }

    if (!fence && skippingModuleStatement) {
      if (trimmed.endsWith(";")) {
        skippingModuleStatement = false;
      }
      continue;
    }

    if (!fence && (trimmed.startsWith("import ") || trimmed.startsWith("export "))) {
      if (!trimmed.endsWith(";")) {
        skippingModuleStatement = true;
      }
      continue;
    }

    normalized.push(
      fence
        ? line
        : line
            .replace(/\s+icon=\{[^}]*\}/g, "")
            .replace(/\s+[A-Za-z_$][\w$:-]*=\{<[^}]+>\}/g, "")
    );
  }

  return normalized.join("\n");
}

const evaluateRuntimeMdx = cache(async (source: string) => {
  const rendererOptions = await getMarkdownRendererOptions();
  const compiled = await evaluate(normalizeRuntimeMdx(source), {
    ...jsxRuntime,
    baseUrl: import.meta.url,
    useMDXComponents: () => runtimeMdxComponents,
    ...rendererOptions
  });

  return compiled.default;
});

export async function RenderedMarkdown({
  components,
  children
}: {
  components?: ComponentProps<typeof Markdown>["components"];
  children: string;
}) {
  const rendererOptions = await getMarkdownRendererOptions();
  const mdxComponents = {
    ...runtimeMdxComponents,
    ...components
  };

  try {
    const Content = await evaluateRuntimeMdx(children);

    return <Content components={mdxComponents} />;
  } catch {
    const normalized = normalizeRuntimeMdx(children);

    return (
      <Markdown components={mdxComponents} {...rendererOptions}>
        {normalized}
      </Markdown>
    );
  }
}
