import { NextResponse } from "next/server";
import { handleReviewRevision } from "./handler";

export async function POST(request: Request) {
  const result = await handleReviewRevision(await request.json().catch(() => null));
  return NextResponse.json(result.payload, { status: result.status });
}
