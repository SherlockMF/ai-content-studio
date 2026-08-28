import { NextResponse } from "next/server";
import { buildHarnessForTopic } from "@/lib/ai/build-harness";
import {
  generateWechatArticlePipeline,
} from "@/lib/ai/generators";
import { WechatGenerateMode } from "@/types/domain";
import { DEMO_MATERIALS, DEMO_PUBLISH_VOICE, DEMO_TOPICS } from "@/lib/mock-data";
import { PublishVoice, Topic, TopicDirection } from "@/types/domain";
import { MaterialItem } from "@/types/domain";
import { formatKnowledgeReferences } from "@/lib/knowledge/prompt-references";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const voice = (body.voice ?? DEMO_PUBLISH_VOICE) as PublishVoice;
  const materials = (body.materials ?? DEMO_MATERIALS) as MaterialItem[];
  const topicId = body.topicId as string | undefined;
  const topicInput = body.topic as Topic | undefined;
  const topic =
    topicInput ??
    DEMO_TOPICS.find((item) => item.id === topicId) ??
    DEMO_TOPICS[0];
  const harness = buildHarnessForTopic(voice, materials, topic);
  const direction = body.direction as TopicDirection | null | undefined;
  const hotspot = body.hotspot as
    | { title: string; url: string; summary?: string }
    | null
    | undefined;
  const mode = (body.mode as WechatGenerateMode | undefined) ?? "from_scratch";
  const existingBody = String(body.existingBody ?? "");
  const existingMeta = body.existingMeta as
    | { title?: string; digest?: string; coverCopy?: string; cta?: string }
    | undefined;
  const supplementaryNotes =
    typeof body.supplementaryNotes === "string" ? body.supplementaryNotes : undefined;

  const materialBodies = materials
    .filter((item) => item.enabled && harness.materialIds.includes(item.id))
    .map((item) => item.body);
  const knowledgeBodies = formatKnowledgeReferences(body.knowledgeReferences);

  try {
    const result = await generateWechatArticlePipeline({
      voice,
      harness,
      topic: {
        ...topic,
        title: body.topicTitle ?? direction?.title ?? topic.title,
        coreViewpoint: direction?.coreViewpoint ?? topic.coreViewpoint,
        openingHook: direction?.openingHook ?? topic.openingHook,
        targetAudience: direction?.targetAudience ?? topic.targetAudience,
        section: direction?.section ?? topic.section,
      },
      materials: [...materialBodies, ...knowledgeBodies],
      hotspot: hotspot ?? null,
      direction: direction ?? null,
      mode,
      existingBody: existingBody || undefined,
      existingMeta,
      supplementaryNotes,
      llm: body.llm,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "生成失败" },
      { status: 500 }
    );
  }
}
