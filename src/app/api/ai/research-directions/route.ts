import { NextResponse } from "next/server";
import { publishedArticlesSchema } from "@/lib/ai/published-topic-check";
import { buildHarnessFromVoice } from "@/lib/ai/build-harness";
import { generateResearchDirections } from "@/lib/ai/generators";
import { DEMO_MATERIALS, DEMO_PUBLISH_VOICE } from "@/lib/mock-data";
import { ContentGoal, ContentSection, PublishVoice } from "@/types/domain";
import { MaterialItem } from "@/types/domain";
import { formatKnowledgeReferences } from "@/lib/knowledge/prompt-references";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const history = publishedArticlesSchema.safeParse(body.publishedArticles ?? []);
  if (!history.success) return NextResponse.json({ message: "已发布稿件数据不完整，请刷新后重试" }, { status: 400 });
  const voice = (body.voice ?? DEMO_PUBLISH_VOICE) as PublishVoice;
  const materials = (body.materials ?? DEMO_MATERIALS) as MaterialItem[];
  const hotspot = body.hotspot as
    | { id: string; title: string; url: string; summary?: string }
    | undefined;

  if (!hotspot?.title || !hotspot.url) {
    return NextResponse.json({ message: "请先选择热点" }, { status: 400 });
  }

  const harness = buildHarnessFromVoice(voice, materials, {
    section: (body.section as ContentSection) ?? voice.defaultSections[0] ?? "AI 通识",
    goal: (body.goal as ContentGoal) ?? "建立专业信任",
  });
  const materialBodies = materials
    .filter((item) => item.enabled && harness.materialIds.includes(item.id))
    .map((item) => item.body);
  const knowledgeBodies = formatKnowledgeReferences(body.knowledgeReferences);

  try {
    const result = await generateResearchDirections({
      voice,
      harness,
      hotspot,
      materials: [...materialBodies, ...knowledgeBodies],
      publishedArticles: history.data,
      llm: body.llm,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "方向生成失败" },
      { status: 500 }
    );
  }
}
