"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CheckCircle2, Languages, Moon, Sun } from "lucide-react";
import { FullSearchTrigger, SearchTrigger as FumaSearchTrigger } from "fumadocs-ui/layouts/shared/slots/search-trigger";
import { useTheme } from "next-themes";
import { useMemo } from "react";

import type { SiteLocale } from "../../lib/i18n";
import { cn } from "../../lib/utils";

const headerCopy = {
  "zh-CN": {
    brand: "APCC 文档中心",
    home: "首页",
    console: "控制台",
    docs: "文档",
    theme: "切换主题",
    language: "中文 / EN"
  },
  en: {
    brand: "APCC Docs Center",
    home: "Home",
    console: "Console",
    docs: "Docs",
    theme: "Toggle theme",
    language: "中文 / EN"
  }
} satisfies Record<SiteLocale, Record<string, string>>;

function peerLocale(locale: SiteLocale): SiteLocale {
  return locale === "zh-CN" ? "en" : "zh-CN";
}

function switchLocalePath(pathname: string | null, locale: SiteLocale): string {
  const target = peerLocale(locale);
  if (!pathname) {
    return `/${target}`;
  }

  if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
    return `/${target}${pathname.slice(locale.length + 1)}`;
  }

  return `/${target}`;
}

function activeSection(pathname: string | null, locale: SiteLocale): "home" | "console" | "docs" {
  if (!pathname || pathname === `/${locale}`) {
    return "home";
  }

  if (pathname.startsWith(`/${locale}/docs/console`)) {
    return "console";
  }

  return "docs";
}

function NavLink({
  href,
  active,
  children
}: {
  href: string;
  active: boolean;
  children: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative inline-flex h-14 items-center px-2.5 text-sm font-medium text-slate-600 transition hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        active && "text-blue-600"
      )}
    >
      {children}
      {active ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-blue-600" /> : null}
    </Link>
  );
}

function ThemeToggle({ locale }: { locale: SiteLocale }) {
  const { resolvedTheme, setTheme } = useTheme();
  const copy = headerCopy[locale];
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={copy.theme}
      title={copy.theme}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-white/10 dark:bg-neutral-950 dark:text-slate-200 dark:hover:bg-white/5"
    >
      {isDark ? <Moon className="size-4" aria-hidden="true" /> : <Sun className="size-4" aria-hidden="true" />}
    </button>
  );
}

function LocaleSwitch({ locale }: { locale: SiteLocale }) {
  const pathname = usePathname();
  const copy = headerCopy[locale];

  return (
    <Link
      href={switchLocalePath(pathname, locale)}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-white/10 dark:bg-neutral-950 dark:text-slate-200 dark:hover:bg-white/5"
    >
      <Languages className="size-4 text-blue-600" aria-hidden="true" />
      {copy.language}
    </Link>
  );
}

function Brand({ locale }: { locale: SiteLocale }) {
  return (
    <Link
      href={`/${locale}`}
      className="flex shrink-0 items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      <span className="relative inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm">
        <BookOpen className="size-4.5" aria-hidden="true" />
        <CheckCircle2 className="absolute -right-1 -bottom-1 size-3 rounded-full bg-white text-blue-600" aria-hidden="true" />
      </span>
      <span className="whitespace-nowrap text-base font-semibold text-slate-950 dark:text-white">{headerCopy[locale].brand}</span>
    </Link>
  );
}

export function AppHeader({
  locale,
  docsHref,
  className
}: {
  locale: SiteLocale;
  docsHref: string;
  className?: string;
}) {
  const pathname = usePathname();
  const copy = headerCopy[locale];
  const active = useMemo(() => activeSection(pathname, locale), [locale, pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 dark:border-white/10 dark:bg-neutral-950/90",
        className
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-3 px-5">
        <div className="flex min-w-0 flex-1 items-center gap-5">
          <Brand locale={locale} />
          <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
            <NavLink href={`/${locale}`} active={active === "home"}>
              {copy.home}
            </NavLink>
            <NavLink href={`/${locale}/docs/console`} active={active === "console"}>
              {copy.console}
            </NavLink>
            <NavLink href={docsHref} active={active === "docs"}>
              {copy.docs}
            </NavLink>
          </nav>
        </div>
        <div className="hidden items-center gap-3 lg:flex">
          <FullSearchTrigger hideIfDisabled className="h-9 w-64 justify-between xl:w-72" />
          <LocaleSwitch locale={locale} />
          <ThemeToggle locale={locale} />
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <FumaSearchTrigger hideIfDisabled />
          <LocaleSwitch locale={locale} />
          <ThemeToggle locale={locale} />
        </div>
      </div>
    </header>
  );
}
