"use client";

import type * as PageTree from "fumadocs-core/page-tree";
import {
  SidebarFolder as BaseSidebarFolder,
  SidebarFolderContent as BaseSidebarFolderContent,
  SidebarFolderLink as BaseSidebarFolderLink,
  SidebarFolderTrigger as BaseSidebarFolderTrigger,
  SidebarItem as BaseSidebarItem,
  SidebarSeparator as BaseSidebarSeparator,
  useFolder,
  useFolderDepth
} from "fumadocs-ui/components/sidebar/base";
import { usePathname } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { cva } from "class-variance-authority";

import { cn } from "../../lib/utils";
import { useDocsLive } from "./docs-live-provider";

const itemVariants = cva(
  "relative flex w-full flex-row items-center gap-2 rounded-lg p-2 text-start text-fd-muted-foreground wrap-anywhere [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        link:
          "transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 hover:transition-none data-[active=true]:bg-fd-primary/10 data-[active=true]:text-fd-primary data-[active=true]:hover:transition-colors",
        button:
          "transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 hover:transition-none"
      },
      highlight: {
        true:
          "data-[active=true]:before:absolute data-[active=true]:before:inset-y-2.5 data-[active=true]:before:inset-s-2.5 data-[active=true]:before:w-px data-[active=true]:before:bg-fd-primary data-[active=true]:before:content-['']"
      }
    }
  }
);

function getItemOffset(depth: number) {
  return `calc(${2 + 3 * depth} * var(--spacing))`;
}

function normalizeHref(value: string): string {
  return value.replace(/\/+$/, "") || "/";
}

function isActiveUrl(target: string, pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }

  const current = normalizeHref(pathname);
  const href = normalizeHref(target);
  return current === href;
}

function hasUnreadNode(
  node: PageTree.Item | PageTree.Folder,
  isUnreadUrl: (href: string) => boolean
): boolean {
  if (node.type === "page") {
    return isUnreadUrl(node.url);
  }

  if (node.index && isUnreadUrl(node.index.url)) {
    return true;
  }

  return node.children.some((child) => {
    if (child.type === "separator") {
      return false;
    }

    return hasUnreadNode(child, isUnreadUrl);
  });
}

function hasActiveNode(node: PageTree.Item | PageTree.Folder, pathname: string | null): boolean {
  if (node.type === "page") {
    return isActiveUrl(node.url, pathname);
  }

  if (node.index && isActiveUrl(node.index.url, pathname)) {
    return true;
  }

  return node.children.some((child) => {
    if (child.type === "separator") {
      return false;
    }

    return hasActiveNode(child, pathname);
  });
}

function SidebarLabel({
  children,
  unread,
  unreadLabel
}: {
  children: ReactNode;
  unread: boolean;
  unreadLabel: string;
}) {
  return (
    <span className="apcc-sidebar-label">
      <span className="apcc-sidebar-title">{children}</span>
      {unread ? <span className="apcc-sidebar-dot" aria-label={unreadLabel} /> : null}
    </span>
  );
}

function NativeSidebarSeparator({
  className,
  style,
  children,
  ...props
}: ComponentProps<typeof BaseSidebarSeparator>) {
  const depth = useFolderDepth();

  return (
    <BaseSidebarSeparator
      className={cn(
        "mb-1 mt-6 inline-flex items-center gap-2 px-2 empty:mb-0 [&_svg]:size-4 [&_svg]:shrink-0",
        depth === 0 && "first:mt-0",
        className
      )}
      style={{
        paddingInlineStart: getItemOffset(depth),
        ...style
      }}
      {...props}
    >
      {children}
    </BaseSidebarSeparator>
  );
}

function NativeSidebarItem({
  className,
  style,
  children,
  ...props
}: ComponentProps<typeof BaseSidebarItem>) {
  const depth = useFolderDepth();

  return (
    <BaseSidebarItem
      className={cn(
        itemVariants({
          variant: "link",
          highlight: depth >= 1
        }),
        className
      )}
      style={{
        paddingInlineStart: getItemOffset(depth),
        ...style
      }}
      {...props}
    >
      {children}
    </BaseSidebarItem>
  );
}

function NativeSidebarFolderTrigger({
  className,
  style,
  children,
  ...props
}: ComponentProps<typeof BaseSidebarFolderTrigger>) {
  const folder = useFolder();
  const depth = folder?.depth ?? 1;
  const collapsible = folder?.collapsible ?? true;

  return (
    <BaseSidebarFolderTrigger
      className={cn(
        itemVariants({
          variant: collapsible ? "button" : undefined
        }),
        "w-full",
        className
      )}
      style={{
        paddingInlineStart: getItemOffset(depth - 1),
        ...style
      }}
      {...props}
    >
      {children}
    </BaseSidebarFolderTrigger>
  );
}

function NativeSidebarFolderLink({
  className,
  style,
  children,
  ...props
}: ComponentProps<typeof BaseSidebarFolderLink>) {
  const depth = useFolderDepth();

  return (
    <BaseSidebarFolderLink
      className={cn(
        itemVariants({
          variant: "link",
          highlight: depth > 1
        }),
        "w-full",
        className
      )}
      style={{
        paddingInlineStart: getItemOffset(depth - 1),
        ...style
      }}
      {...props}
    >
      {children}
    </BaseSidebarFolderLink>
  );
}

function NativeSidebarFolderContent({
  className,
  children,
  ...props
}: ComponentProps<typeof BaseSidebarFolderContent>) {
  const depth = useFolderDepth();

  return (
    <BaseSidebarFolderContent
      className={cn(
        "relative",
        depth === 1 && "before:absolute before:inset-y-1 before:inset-s-2.5 before:w-px before:bg-fd-border before:content-['']",
        className
      )}
      {...props}
    >
      <div className="flex flex-col gap-0.5 pt-0.5">{children}</div>
    </BaseSidebarFolderContent>
  );
}

export function DocsSidebarItem({ item }: { item: PageTree.Item }) {
  const pathname = usePathname();
  const { isUnreadUrl, unreadLabel } = useDocsLive();

  return (
    <NativeSidebarItem
      href={item.url}
      external={item.external}
      active={isActiveUrl(item.url, pathname)}
      icon={item.icon}
    >
      <SidebarLabel unread={isUnreadUrl(item.url)} unreadLabel={unreadLabel}>
        {item.name}
      </SidebarLabel>
    </NativeSidebarItem>
  );
}

export function DocsSidebarFolder({
  item,
  children
}: {
  item: PageTree.Folder;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { isUnreadUrl, unreadLabel } = useDocsLive();
  const unread = hasUnreadNode(item, isUnreadUrl);
  const active = hasActiveNode(item, pathname);
  const label = (
    <SidebarLabel unread={unread} unreadLabel={unreadLabel}>
      {item.name}
    </SidebarLabel>
  );

  return (
    <BaseSidebarFolder collapsible={item.collapsible} active={active} defaultOpen={item.defaultOpen}>
      {item.index ? (
        <NativeSidebarFolderLink
          href={item.index.url}
          active={isActiveUrl(item.index.url, pathname)}
          external={item.index.external}
        >
          {item.icon}
          {label}
        </NativeSidebarFolderLink>
      ) : (
        <NativeSidebarFolderTrigger>
          {item.icon}
          {label}
        </NativeSidebarFolderTrigger>
      )}
      <NativeSidebarFolderContent>{children}</NativeSidebarFolderContent>
    </BaseSidebarFolder>
  );
}

export function DocsSidebarSeparator({ item }: { item: PageTree.Separator }) {
  return (
    <NativeSidebarSeparator>
      {item.icon}
      {item.name}
    </NativeSidebarSeparator>
  );
}
