import { NextResponse } from "next/server";
import { suggestCoverImages } from "@/lib/ai/generators";
import { isEvaluationDraft } from "@/lib/draft-profile";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const title = String(body.title ?? "");
  const digest = body.digest ? String(body.digest) : undefined;
  const coverCopy = body.coverCopy ? String(body.coverCopy) : undefined;
  const articleBody = body.body ? String(body.body) : undefined;
  const topicId = body.topicId ? String(body.topicId) : undefined;

  if (!title.trim() && !articleBody?.trim()) {
    return NextResponse.json({ message: "请先填写标题或正文" }, { status: 400 });
  }

  const isEvaluation =
    typeof body.isEvaluation === "boolean"
      ? body.isEvaluation
      : isEvaluationDraft({ topicId: topicId ?? "", body: articleBody ?? "" });

  try {
    const result = await suggestCoverImages({
      title: title || "（无标题）",
      digest,
      coverCopy,
      body: articleBody,
      isEvaluation,
      llm: body.llm,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "封面图分析失败" },
      { status: 500 }
    );
  }
}
