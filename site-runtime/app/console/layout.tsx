import type { ReactNode } from "react";

import { LiveRefresh } from "../../components/site/live-refresh";
import { loadRuntimeMetadata, loadRuntimeVersion } from "../../lib/runtime-data";

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const runtime = await loadRuntimeMetadata();
  const version = await loadRuntimeVersion();

  return (
    <>
      {runtime.mode === "live" ? <LiveRefresh initialVersion={version.updatedAt} /> : null}
      {children}
    </>
  );
}
