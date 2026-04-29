import { NextResponse } from "next/server";

import { loadRuntimeMetadata, loadRuntimeVersion } from "@/lib/runtime-data";

export async function GET() {
  const [version, metadata] = await Promise.all([loadRuntimeVersion(), loadRuntimeMetadata()]);

  return NextResponse.json({
    updatedAt: version.updatedAt,
    siteId: metadata.siteId,
    runtimeRoot: metadata.runtimeRoot,
    sourceDocsRoot: metadata.sourceDocsRoot,
    mode: metadata.mode
  });
}
