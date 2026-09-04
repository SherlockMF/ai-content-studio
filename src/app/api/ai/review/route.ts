import { NextResponse } from "next/server";
import { reviewContent, reviewXiaohongshuContent } from "@/lib/ai/reviewers";

export async function POST(request: Request) {
  const body = await request.json();
  try {
    const result =
      body.platform === "xiaohongshu"
        ? await reviewXiaohongshuContent({
            sourceBody: body.sourceBody ?? "",
            title: body.title ?? "",
            body: body.body ?? "",
            cta: body.cta ?? "",
            hashtags: Array.isArray(body.hashtags) ? body.hashtags : [],
            visualDirection: body.visualDirection ?? "",
            imagePlan: Array.isArray(body.imagePlan) ? body.imagePlan : [],
            targetAudience: body.targetAudience ?? "",
            llm: body.llm,
          })
        : await reviewContent({
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
