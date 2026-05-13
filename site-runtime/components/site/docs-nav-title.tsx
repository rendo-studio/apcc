"use client";

import type { ComponentProps } from "react";
import Link from "fumadocs-core/link";
import { useDocsLayout } from "fumadocs-ui/layouts/docs";
import { ArrowLeft } from "lucide-react";

export function DocsNavTitle({ className, href, ...props }: ComponentProps<"a">) {
  const { props: layoutProps } = useDocsLayout();
  const title = layoutProps.nav?.title;
  const url = layoutProps.nav?.url ?? href ?? "/";
  const content = typeof title === "function" ? null : title;

  return (
    <Link href={url} {...props} className={[className, "inline-flex items-center gap-2"].filter(Boolean).join(" ")}>
      <ArrowLeft className="size-4" />
      {content}
    </Link>
  );
}
