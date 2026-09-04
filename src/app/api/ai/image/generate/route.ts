import { NextResponse } from "next/server";
import { handleImageGenerateRequest } from "./handler";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = await handleImageGenerateRequest(body);
  return NextResponse.json(result.payload, { status: result.status });
}
