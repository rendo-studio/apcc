import { NextResponse } from "next/server";

import { loadRuntimeVersion } from "@/lib/runtime-data";

export async function GET() {
  return NextResponse.json(await loadRuntimeVersion());
}
