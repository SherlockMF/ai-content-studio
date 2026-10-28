import { z } from "zod";
import { buildGenerationContext } from "@/lib/ai/context";
import { generateTopics } from "@/lib/ai/generators";
import { publishedArticlesSchema } from "@/lib/ai/published-topic-check";
import { defineHandler } from "@/lib/api/handler";
import { arrayOf, llmRequestSchema, objectOf } from "@/lib/api/schemas";
import { DEFAULT_PUBLISH_VOICE } from "@/lib/defaults";
import type { MaterialItem, PublishVoice, Topic } from "@/types/domain";

const schema = z.object({
  publishedArticles: z.preprocess((value) => value ?? [], publishedArticlesSchema),
  count: z.unknown().optional(),
  voice: objectOf<PublishVoice>().nullish(),
  materials: arrayOf<MaterialItem>().nullish(),
  historyTitles: arrayOf<string>().nullish(),
  topic: objectOf<Topic>().nullish(),
  knowledgeReferences: z.unknown().optional(),
  llm: llmRequestSchema,
});

export const { POST } = defineHandler({
  schema,
  invalidMessage: "已发布稿件数据不完整，请刷新后重试",
  failureMessage: "生成失败",
  run: (input) => {
    const voice = input.voice ?? DEFAULT_PUBLISH_VOICE;
    const context = buildGenerationContext({
      voice,
      materials: input.materials ?? [],
      knowledgeReferences: input.knowledgeReferences,
      topic: input.topic ?? undefined,
    });
    return generateTopics({
      voice,
      harness: context.harness,
      materials: context.materials,
      historyTitles: input.historyTitles ?? [],
      publishedArticles: input.publishedArticles,
      count: Number(input.count ?? 3),
      llm: input.llm,
    });
  },
});
