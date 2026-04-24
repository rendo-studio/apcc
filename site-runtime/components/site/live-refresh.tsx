"use client";

import { useEffect, useEffectEvent, useRef } from "react";

export function LiveRefresh({ initialVersion }: { initialVersion: string }) {
  const currentVersion = useRef(initialVersion);

  useEffect(() => {
    currentVersion.current = initialVersion;
  }, [initialVersion]);

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
    const timer = window.setInterval(() => {
      void checkVersion();
    }, 2000);

    return () => {
      window.clearInterval(timer);
    };
  }, [checkVersion]);

  return null;
}
