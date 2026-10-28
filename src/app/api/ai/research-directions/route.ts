import { z } from "zod";
import { buildGenerationContext } from "@/lib/ai/context";
import { generateResearchDirections } from "@/lib/ai/generators";
import { publishedArticlesSchema } from "@/lib/ai/published-topic-check";
import { defineHandler, HandlerError } from "@/lib/api/handler";
import { arrayOf, llmRequestSchema, objectOf } from "@/lib/api/schemas";
import { DEFAULT_PUBLISH_VOICE } from "@/lib/defaults";
import type { ContentGoal, ContentSection, MaterialItem, PublishVoice } from "@/types/domain";

type HotspotInput = { id: string; title: string; url: string; summary?: string };

const schema = z.object({
  publishedArticles: z.preprocess((value) => value ?? [], publishedArticlesSchema),
  voice: objectOf<PublishVoice>().nullish(),
  materials: arrayOf<MaterialItem>().nullish(),
  hotspot: objectOf<HotspotInput>().nullish(),
  section: z.unknown().optional(),
  goal: z.unknown().optional(),
  knowledgeReferences: z.unknown().optional(),
  llm: llmRequestSchema,
});

export const { POST } = defineHandler({
  schema,
  invalidMessage: "已发布稿件数据不完整，请刷新后重试",
  failureMessage: "方向生成失败",
  run: (input) => {
    const hotspot = input.hotspot;
    if (!hotspot?.title || !hotspot.url) throw new HandlerError("请先选择热点");
    const voice = input.voice ?? DEFAULT_PUBLISH_VOICE;
    const context = buildGenerationContext({
      voice,
      materials: input.materials ?? [],
      knowledgeReferences: input.knowledgeReferences,
      harnessOverrides: {
        section: (input.section as ContentSection) ?? voice.defaultSections[0] ?? "AI 通识",
        goal: (input.goal as ContentGoal) ?? "建立专业信任",
      },
    });
    return generateResearchDirections({
      voice,
      harness: context.harness,
      hotspot,
      materials: context.materials,
      publishedArticles: input.publishedArticles,
      llm: input.llm,
    });
  },
});
