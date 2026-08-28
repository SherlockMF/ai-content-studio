import { NextResponse } from "next/server";
import { buildHarnessForTopic, buildHarnessFromVoice } from "@/lib/ai/build-harness";
import { generateTopics } from "@/lib/ai/generators";
import { DEMO_MATERIALS, DEMO_PUBLISH_VOICE, DEMO_TOPICS } from "@/lib/mock-data";
import { PublishVoice, Topic } from "@/types/domain";
import { MaterialItem } from "@/types/domain";
import { formatKnowledgeReferences } from "@/lib/knowledge/prompt-references";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const count = Number(body.count ?? 3);
  const voice = (body.voice ?? DEMO_PUBLISH_VOICE) as PublishVoice;
  const materials = (body.materials ?? DEMO_MATERIALS) as MaterialItem[];
  const historyTitles = (body.historyTitles as string[] | undefined) ?? DEMO_TOPICS.map((t) => t.title);
  const harness = body.topic
    ? buildHarnessForTopic(voice, materials, body.topic as Topic)
    : buildHarnessFromVoice(voice, materials);

  const materialBodies = materials
    .filter((item) => item.enabled && harness.materialIds.includes(item.id))
    .map((item) => item.body);
  const knowledgeBodies = formatKnowledgeReferences(body.knowledgeReferences);

  try {
    const result = await generateTopics({
      voice,
      harness,
      materials: [...materialBodies, ...knowledgeBodies],
      historyTitles,
      count,
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
