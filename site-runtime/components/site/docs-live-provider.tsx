"use client";

import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import type { SiteLocale } from "../../lib/i18n";
import { docsHref, getSiteCopy } from "../../lib/site-copy";

interface DocsLivePage {
  path: string;
  title: string;
  latestRevisionId: string | null;
  revisionCount: number;
}

interface DocsLiveProviderProps {
  children: ReactNode;
  enabled: boolean;
  locale: SiteLocale;
  initialVersion: string;
  pages: DocsLivePage[];
  workspaceStateDigest: string | null;
}

interface DocsLiveBrowserState {
  knownDocs: Record<string, string>;
  seenDocs: Record<string, string>;
  knownWorkspaceDigest: string | null;
}

interface DocsLiveContextValue {
  isUnreadUrl: (href: string) => boolean;
  unreadLabel: string;
}

const DocsLiveContext = createContext<DocsLiveContextValue>({
  isUnreadUrl: () => false,
  unreadLabel: "Unread update"
});

function storageKey(prefix: string) {
  return `apcc-docs-${prefix}-v2`;
}

function readMap(key: string): Record<string, string> {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function readString(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeMap(key: string, value: Record<string, string>) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function writeString(key: string, value: string | null) {
  if (value === null) {
    window.localStorage.removeItem(key);
    return;
  }

  window.localStorage.setItem(key, value);
}

function normalizeHref(value: string): string {
  return value.replace(/\/+$/, "") || "/";
}

function equalMaps(left: Record<string, string>, right: Record<string, string>): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[key] === right[key]);
}

function equalBrowserState(left: DocsLiveBrowserState, right: DocsLiveBrowserState): boolean {
  return (
    left.knownWorkspaceDigest === right.knownWorkspaceDigest &&
    equalMaps(left.knownDocs, right.knownDocs) &&
    equalMaps(left.seenDocs, right.seenDocs)
  );
}

export function useDocsLive() {
  return useContext(DocsLiveContext);
}

export function DocsLiveProvider({
  children,
  enabled,
  locale,
  initialVersion,
  pages,
  workspaceStateDigest
}: DocsLiveProviderProps) {
  const pathname = usePathname();
  const currentVersion = useRef(initialVersion);
  const [browserState, setBrowserState] = useState<DocsLiveBrowserState | null>(null);
  const copy = getSiteCopy(locale);

  const latestByUrl = useMemo(
    () =>
      Object.fromEntries(
        pages
          .filter((page) => page.latestRevisionId)
          .map((page) => [normalizeHref(docsHref(locale, page.path)), page.latestRevisionId as string])
      ),
    [locale, pages]
  );

  useEffect(() => {
    currentVersion.current = initialVersion;
  }, [initialVersion]);

  useEffect(() => {
    setBrowserState({
      knownDocs: readMap(storageKey("known-docs")),
      seenDocs: readMap(storageKey("seen-docs")),
      knownWorkspaceDigest: readString(storageKey("workspace-digest"))
    });
  }, []);

  useEffect(() => {
    if (!browserState) {
      return;
    }

    const normalizedPath = pathname ? normalizeHref(pathname) : null;
    const nextSeenDocs = { ...browserState.seenDocs };
    const currentRevisionId = normalizedPath ? latestByUrl[normalizedPath] : undefined;
    if (normalizedPath && currentRevisionId) {
      nextSeenDocs[normalizedPath] = currentRevisionId;
    }

    const unreadChanged = pages.filter((page) => {
      const latestRevisionId = page.latestRevisionId;
      if (!latestRevisionId || page.revisionCount < 2) {
        return false;
      }

      return nextSeenDocs[normalizeHref(docsHref(locale, page.path))] !== latestRevisionId;
    });

    const isFirstHydration =
      Object.keys(browserState.knownDocs).length === 0 && browserState.knownWorkspaceDigest === null;
    if (!isFirstHydration) {
      const newlyUpdatedDocs = unreadChanged.filter(
        (page) => browserState.knownDocs[normalizeHref(docsHref(locale, page.path))] !== page.latestRevisionId
      );
      if (newlyUpdatedDocs.length > 0) {
        const preview = newlyUpdatedDocs
          .slice(0, 3)
          .map((page) => page.title)
          .join(" · ");
        toast(copy.toasts.docsUpdatedTitle, {
          id: "apcc-docs-updated",
          description:
            newlyUpdatedDocs.length > 3
              ? copy.toasts.docsUpdatedMany(preview, newlyUpdatedDocs.length)
              : copy.toasts.docsUpdatedOne(preview)
        });
      }

      if (
        workspaceStateDigest &&
        browserState.knownWorkspaceDigest &&
        browserState.knownWorkspaceDigest !== workspaceStateDigest
      ) {
        toast(copy.toasts.workspaceUpdatedTitle, {
          id: "apcc-workspace-updated",
          description: copy.toasts.workspaceUpdatedDescription
        });
      }
    }

    const nextState: DocsLiveBrowserState = {
      knownDocs: latestByUrl,
      seenDocs: nextSeenDocs,
      knownWorkspaceDigest: workspaceStateDigest ?? browserState.knownWorkspaceDigest
    };

    writeMap(storageKey("known-docs"), nextState.knownDocs);
    writeMap(storageKey("seen-docs"), nextState.seenDocs);
    writeString(storageKey("workspace-digest"), nextState.knownWorkspaceDigest);

    if (!equalBrowserState(browserState, nextState)) {
      setBrowserState(nextState);
    }
  }, [browserState, copy, latestByUrl, locale, pages, pathname, workspaceStateDigest]);

  const checkVersion = useEffectEvent(async () => {
    const response = await fetch("/api/apcc/version", {
      cache: "no-store"
    }).catch(() => null);

    if (!response?.ok) {
      return;
    }

    const payload = (await response.json()) as { updatedAt?: string };
    if (!payload.updatedAt || payload.updatedAt === currentVersion.current) {
      return;
    }

    currentVersion.current = payload.updatedAt;
    window.location.reload();
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timer = window.setInterval(() => {
      void checkVersion();
    }, 2000);

    return () => {
      window.clearInterval(timer);
    };
  }, [checkVersion, enabled]);

  const contextValue = useMemo<DocsLiveContextValue>(() => {
    const normalizedPath = pathname ? normalizeHref(pathname) : null;

    return {
      isUnreadUrl(href: string) {
        const normalizedHref = normalizeHref(href);
        const latestRevisionId = latestByUrl[normalizedHref];
        if (!latestRevisionId) {
          return false;
        }

        if (normalizedPath === normalizedHref) {
          return false;
        }

        return browserState?.seenDocs[normalizedHref] !== latestRevisionId;
      },
      unreadLabel: copy.sidebar.unreadUpdate
    };
  }, [browserState?.seenDocs, copy.sidebar.unreadUpdate, latestByUrl, pathname]);

  return <DocsLiveContext.Provider value={contextValue}>{children}</DocsLiveContext.Provider>;
}
