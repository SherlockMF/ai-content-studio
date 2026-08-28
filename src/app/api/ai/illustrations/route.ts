import { NextResponse } from "next/server";
import { suggestIllustrations } from "@/lib/ai/generators";
import { isEvaluationDraft } from "@/lib/draft-profile";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const title = String(body.title ?? "");
  const articleBody = String(body.body ?? "");
  const topicId = body.topicId ? String(body.topicId) : undefined;

  if (!articleBody.trim()) {
    return NextResponse.json({ message: "请先填写正文" }, { status: 400 });
  }

  const isEvaluation =
    typeof body.isEvaluation === "boolean"
      ? body.isEvaluation
      : isEvaluationDraft({ topicId: topicId ?? "", body: articleBody });

  try {
    const result = await suggestIllustrations({
      title: title || "（无标题）",
      body: articleBody,
      isEvaluation,
      llm: body.llm,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "配图分析失败" },
      { status: 500 }
    );
  }
}
