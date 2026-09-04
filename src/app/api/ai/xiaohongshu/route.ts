import { NextResponse } from "next/server";
import { handleXiaohongshuRequest } from "./handler";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = await handleXiaohongshuRequest(body);
  return NextResponse.json(result.payload, { status: result.status });
}
