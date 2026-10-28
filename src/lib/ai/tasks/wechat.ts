import { getLLMProvider } from "@/lib/ai/providers";
import { buildDirectionPrompt, buildHotspotPrompt } from "@/lib/ai/prompts";
import { wechatArticleSchema } from "@/lib/ai/schemas";
import type { HotspotItem } from "@/lib/hotspots/types";
import {
  applyIllustrationSuggestionsToBody,
  countBodyIllustrationPlaceholders,
  prependCoverPlaceholder,
} from "@/lib/illustrations/enrich-article-media";
import type { normalizeIllustrationSuggestion } from "@/lib/illustrations/heuristic";
import {
  analyzeReadingTime,
  buildReadingTimeGeneratePrompt,
  resolveReadingProfile,
} from "@/lib/reading-time";
import { buildWechatNarrativeStylePrompt } from "@/lib/wechat-narrative-style";
import type {
  GenerationHarness,
  PublishVoice,
  Topic,
  TopicDirection,
  WechatGenerateMode,
} from "@/types/domain";
import { suggestCoverImages } from "./cover";
import { suggestIllustrations } from "./illustrations";
import { deAiRewrite, rewriteExistingDraft } from "./rewrite";
import { buildTaskMessages, isEvaluationTitle, type WechatArticleResult, type WithLLM } from "./shared";

type WechatSourceInput = {
  voice: PublishVoice;
  harness: GenerationHarness;
  topic: Topic;
  materials: string[];
  hotspot?: Pick<HotspotItem, "title" | "url" | "summary"> | null;
  direction?: Pick<
    TopicDirection,
    "title" | "angle" | "whyNow" | "coreViewpoint" | "outline" | "leverageAngle"
  > | null;
} & WithLLM;

export async function generateWechatArticle(input: WechatSourceInput) {
  const provider = getLLMProvider(input.llm);
  const extraPrompts: string[] = [];
  if (input.hotspot) {
    extraPrompts.push(
      buildHotspotPrompt({
        ...input.hotspot,
        leverageAngle: input.direction?.leverageAngle,
      })
    );
  }
  if (input.direction) {
    extraPrompts.push(buildDirectionPrompt(input.direction));
  }

  const readingProfile = resolveReadingProfile({
    section: input.topic.section,
    isEvaluation: isEvaluationTitle(input.topic.title),
  });
  extraPrompts.push(buildReadingTimeGeneratePrompt(readingProfile));
  extraPrompts.push(buildWechatNarrativeStylePrompt());

  const messages = buildTaskMessages(
    input.voice,
    input.harness,
    { materials: input.materials, historyTitles: [input.topic.title] },
    `${extraPrompts.join("\n")}
Task: generateWechatArticle
基于选题“${input.topic.title}”生成公众号图文：title、digest、coverCopy、body、cta。正文结合热点背景但不过度蹭热点，尽量少用翻案腔和模型黑话。严格遵守上文阅读时长与叙事排版要求。`
  );

  return provider.generateStructuredOutput<WechatArticleResult>(messages, wechatArticleSchema);
}

export async function polishImportedDraft(
  input: {
    voice: PublishVoice;
    topic: Topic;
    existingBody: string;
    title?: string;
    digest?: string;
    coverCopy?: string;
    cta?: string;
    supplementaryNotes?: string;
  } & WithLLM
) {
  return rewriteExistingDraft(input);
}

/** 出稿后自动去 AI 味；支持从零生成、仅润色、保留测评结构扩写 */
export async function generateWechatArticlePipeline(
  input: WechatSourceInput & {
    mode?: WechatGenerateMode;
    existingBody?: string;
    existingMeta?: { title?: string; digest?: string; coverCopy?: string; cta?: string };
    supplementaryNotes?: string;
  }
) {
  const mode = input.mode ?? "from_scratch";

  if ((mode === "polish" || mode === "preserve_structure") && input.existingBody?.trim()) {
    return rewriteExistingDraft({
      topic: input.topic,
      existingBody: input.existingBody,
      title: input.existingMeta?.title,
      digest: input.existingMeta?.digest,
      coverCopy: input.existingMeta?.coverCopy,
      cta: input.existingMeta?.cta,
      supplementaryNotes: input.supplementaryNotes,
      llm: input.llm,
      emptyNotesFallback:
        mode === "preserve_structure" ? "已在保留测评结构与数据前提下分段润色。" : undefined,
    });
  }

  const generated = await generateWechatArticle(input);
  const readingProfile = resolveReadingProfile({
    section: input.topic.section,
    isEvaluation: isEvaluationTitle(input.topic.title),
  });
  const rewritten = await deAiRewrite({
    original: generated.body,
    title: generated.title,
    llm: input.llm,
    readingProfile,
  });
  const reading = analyzeReadingTime(rewritten.candidate, readingProfile);
  const article: WechatArticleResult = {
    ...generated,
    body: rewritten.candidate,
    notes: [rewritten.notes, `完读约 ${reading.minutes} 分钟（${reading.statusLabel}）`]
      .filter(Boolean)
      .join(" · "),
  };

  return enrichWechatArticleWithMedia(article, {
    llm: input.llm,
    isEvaluation: readingProfile === "evaluation" || isEvaluationTitle(input.topic.title),
  });
}

/** 出稿后自动规划正文配图位 + 封面提示词，并写入正文 */
export async function enrichWechatArticleWithMedia(
  article: WechatArticleResult,
  input: { isEvaluation?: boolean } & WithLLM
): Promise<WechatArticleResult> {
  const existingSlots = countBodyIllustrationPlaceholders(article.body);
  const [illustrations, covers] = await Promise.all([
    existingSlots >= 3
      ? Promise.resolve({
          summary: "正文已含配图位，跳过重复规划",
          suggestions: [] as ReturnType<typeof normalizeIllustrationSuggestion>[],
        })
      : suggestIllustrations({
          title: article.title,
          body: article.body,
          isEvaluation: input.isEvaluation,
          llm: input.llm,
        }),
    suggestCoverImages({
      title: article.title,
      digest: article.digest,
      coverCopy: article.coverCopy,
      body: article.body,
      isEvaluation: input.isEvaluation,
      llm: input.llm,
    }),
  ]);

  let body = article.body;
  let inserted = 0;
  if (illustrations.suggestions.length > 0) {
    const applied = applyIllustrationSuggestionsToBody(body, illustrations.suggestions);
    body = applied.body;
    inserted = applied.inserted;
  }

  const primaryCover = covers.variants[0];
  if (primaryCover) {
    body = prependCoverPlaceholder(body, primaryCover);
  }

  const coverCopy =
    article.coverCopy.trim() || primaryCover?.overlayText?.trim() || article.coverCopy;

  const notes = [
    article.notes,
    inserted > 0 ? `已自动插入 ${inserted} 处正文配图位` : undefined,
    covers.variants.length > 0 ? "已生成封面图提示词" : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    ...article,
    body,
    coverCopy,
    notes,
    coverSummary: covers.summary,
    coverVariants: covers.variants.slice(0, 1),
    illustrationSummary: illustrations.summary,
    illustrationInserted: inserted,
  };
}
