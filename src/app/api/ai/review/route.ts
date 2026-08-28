import { NextResponse } from "next/server";
import { reviewContent } from "@/lib/ai/reviewers";

export async function POST(request: Request) {
  const body = await request.json();
  try {
    const result = await reviewContent({
      title: body.title ?? "",
      body: body.body ?? "",
      targetAudience: body.targetAudience ?? "",
      supplementaryNotes: body.supplementaryNotes,
      llm: body.llm,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "质检失败" },
      { status: 500 }
    );
  }
}
