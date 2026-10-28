import { buildHarnessForTopic, buildHarnessFromVoice } from "@/lib/ai/build-harness";
import { formatKnowledgeReferences } from "@/lib/knowledge/prompt-references";
import type { GenerationHarness, MaterialItem, PublishVoice, Topic } from "@/types/domain";

/**
 * 生成任务共用上下文：按人设/选题构建 harness，
 * 并把 harness 选中的启用素材与知识库引用拼成模型可读的素材列表。
 */
export function buildGenerationContext(input: {
  voice: PublishVoice;
  materials: MaterialItem[];
  knowledgeReferences?: unknown;
  topic?: Pick<Topic, "section" | "contentGoal" | "targetAudience">;
  harnessOverrides?: Partial<GenerationHarness>;
}) {
  const harness = input.topic
    ? buildHarnessForTopic(input.voice, input.materials, input.topic)
    : buildHarnessFromVoice(input.voice, input.materials, input.harnessOverrides);
  const materialBodies = input.materials
    .filter((item) => item.enabled && harness.materialIds.includes(item.id))
    .map((item) => item.body);
  return {
    harness,
    materials: [...materialBodies, ...formatKnowledgeReferences(input.knowledgeReferences)],
  };
}
