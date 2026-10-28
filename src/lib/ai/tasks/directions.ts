import { getLLMProvider } from "@/lib/ai/providers";
import { checkPublishedTopics, publishedTopicsPrompt, type PublishedArticle } from "@/lib/ai/published-topic-check";
import { buildHotspotPrompt } from "@/lib/ai/prompts";
import { researchDirectionsOutputSchema } from "@/lib/ai/schemas";
import { TOPIC_SELECTION_RULES } from "@/lib/content-ops/topic-publish-revision";
import type { HotspotItem } from "@/lib/hotspots/types";
import type { GenerationHarness, PublishVoice } from "@/types/domain";
import { buildTaskMessages, type WithLLM } from "./shared";

export async function generateResearchDirections(
  input: {
    voice: PublishVoice;
    harness: GenerationHarness;
    hotspot: Pick<HotspotItem, "id" | "title" | "url" | "summary" | "leverageHint">;
    materials: string[];
    publishedArticles?: PublishedArticle[];
  } & WithLLM
) {
  const provider = getLLMProvider(input.llm);
  const messages = buildTaskMessages(
    input.voice,
    input.harness,
    { materials: input.materials, historyTitles: [] },
    `Task: generateResearchDirections
基于下面这条 AI 相关热点，为当前账号人设输出：
1) leverageAngle：一句话说明如何蹭这个热点、又不偏离账号定位
2) directions：恰好 3 个不同切口的话题方向。每个方向要有 title、angle、whyNow、targetAudience、outline（4-6 条提纲）、coreViewpoint、section（四板块之一）、openingHook。
要求三个方向差异明显，避免同义重复。${buildHotspotPrompt(input.hotspot)}
${TOPIC_SELECTION_RULES}
${publishedTopicsPrompt(input.publishedArticles ?? [])}`
  );

  const result = researchDirectionsOutputSchema.parse(await provider.generateStructuredOutput(messages, researchDirectionsOutputSchema));
  const checked = await checkPublishedTopics(provider, result.directions, input.publishedArticles ?? []);
  return { ...result, directions: checked.items, deduplication: checked.deduplication };
}
