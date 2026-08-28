import { NextResponse } from "next/server";
import { researchHotspots } from "@/lib/hotspots/service";

export const runtime = "nodejs";

export async function GET() {
  const { readHotspotSnapshot } = await import("@/lib/hotspots/cache");
  const cached = readHotspotSnapshot();
  return NextResponse.json({
    snapshot: cached.snapshot,
    stale: cached.stale,
    expired: cached.expired,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const forceRefresh = Boolean(body.forceRefresh);
    const result = await researchHotspots(forceRefresh);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "热点抓取失败" },
      { status: 500 }
    );
  }
}
