import { NextResponse } from "next/server";
import { deAiRewrite } from "@/lib/ai/generators";
import { DE_AI_SKILL_SOURCES } from "@/lib/ai/skills";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const original = String(body.original ?? body.body ?? "");
  const title = body.title ? String(body.title) : undefined;

  if (!original.trim()) {
    return NextResponse.json({ message: "缺少待改写正文" }, { status: 400 });
  }

  try {
    const result = await deAiRewrite({ original, title, llm: body.llm });
    return NextResponse.json({
      ...result,
      skills: DE_AI_SKILL_SOURCES,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "去 AI 味改写失败" },
      { status: 500 }
    );
  }
}
