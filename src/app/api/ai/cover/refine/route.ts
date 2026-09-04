import { NextResponse } from "next/server";
import { handleCoverRefineRequest } from "./handler";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = await handleCoverRefineRequest(body);
  return NextResponse.json(result.payload, { status: result.status });
}
