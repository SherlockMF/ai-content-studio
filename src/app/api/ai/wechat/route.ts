import { z } from "zod";
import { buildGenerationContext } from "@/lib/ai/context";
import { generateWechatArticlePipeline } from "@/lib/ai/generators";
import { defineHandler } from "@/lib/api/handler";
import { arrayOf, llmRequestSchema, objectOf, titledObjectOf } from "@/lib/api/schemas";
import { DEFAULT_PUBLISH_VOICE } from "@/lib/defaults";
import type { MaterialItem, PublishVoice, Topic, TopicDirection, WechatGenerateMode } from "@/types/domain";

type HotspotInput = { title: string; url: string; summary?: string };
type ExistingMeta = { title?: string; digest?: string; coverCopy?: string; cta?: string };

const schema = z.object({
  topic: titledObjectOf<Topic>(),
  voice: objectOf<PublishVoice>().nullish(),
  materials: arrayOf<MaterialItem>().nullish(),
  direction: objectOf<TopicDirection>().nullish(),
  hotspot: objectOf<HotspotInput>().nullish(),
  mode: z.custom<WechatGenerateMode>((value) => typeof value === "string").nullish(),
  topicTitle: z.string().nullish(),
  existingBody: z.unknown().optional(),
  existingMeta: objectOf<ExistingMeta>().nullish(),
  supplementaryNotes: z.unknown().optional(),
  knowledgeReferences: z.unknown().optional(),
  llm: llmRequestSchema,
});

export const { POST } = defineHandler({
  schema,
  invalidMessage: "缺少选题",
  failureMessage: "生成失败",
  run: (input) => {
    const { topic, direction } = input;
    const voice = input.voice ?? DEFAULT_PUBLISH_VOICE;
    const context = buildGenerationContext({
      voice,
      materials: input.materials ?? [],
      knowledgeReferences: input.knowledgeReferences,
      topic,
    });
    const existingBody = String(input.existingBody ?? "");
    return generateWechatArticlePipeline({
      voice,
      harness: context.harness,
      topic: {
        ...topic,
        title: input.topicTitle ?? direction?.title ?? topic.title,
        coreViewpoint: direction?.coreViewpoint ?? topic.coreViewpoint,
        openingHook: direction?.openingHook ?? topic.openingHook,
        targetAudience: direction?.targetAudience ?? topic.targetAudience,
        section: direction?.section ?? topic.section,
      },
      materials: context.materials,
      hotspot: input.hotspot ?? null,
      direction: direction ?? null,
      mode: input.mode ?? "from_scratch",
      existingBody: existingBody || undefined,
      existingMeta: input.existingMeta ?? undefined,
      supplementaryNotes: typeof input.supplementaryNotes === "string" ? input.supplementaryNotes : undefined,
      llm: input.llm,
    });
  },
});
