import { getLLMProvider } from "@/lib/ai/providers";
import { checkPublishedTopics, publishedTopicsPrompt, type PublishedArticle } from "@/lib/ai/published-topic-check";
import { topicsOutputSchema } from "@/lib/ai/schemas";
import { TOPIC_SELECTION_RULES } from "@/lib/content-ops/topic-publish-revision";
import type { GenerationHarness, PublishVoice } from "@/types/domain";
import { buildTaskMessages, type WithLLM } from "./shared";

export async function generateTopics(
  input: {
    voice: PublishVoice;
    harness: GenerationHarness;
    materials: string[];
    historyTitles: string[];
    publishedArticles?: PublishedArticle[];
    count: number;
  } & WithLLM
) {
  const provider = getLLMProvider(input.llm);
  const messages = buildTaskMessages(
    input.voice,
    input.harness,
    { materials: input.materials, historyTitles: input.historyTitles },
    `Task: generateTopics\n请输出 ${input.count} 条结构化选题，默认平台公众号，覆盖不同内容板块并避免重复。\n${TOPIC_SELECTION_RULES}\n${publishedTopicsPrompt(input.publishedArticles ?? [])}`
  );

  const result = topicsOutputSchema.parse(await provider.generateStructuredOutput(messages, topicsOutputSchema));
  const checked = await checkPublishedTopics(provider, result.topics, input.publishedArticles ?? []);
  return { ...result, topics: checked.items, deduplication: checked.deduplication };
}
