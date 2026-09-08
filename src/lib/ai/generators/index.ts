import { getLLMProvider } from "@/lib/ai/providers";
import { LLMClientSettings } from "@/lib/ai/llm-settings";
import { LLMMessage } from "@/lib/ai/providers/types";
import {
  buildContextPrompt,
  buildDirectionPrompt,
  buildHarnessPrompt,
  buildHotspotPrompt,
  buildVoicePrompt,
  SYSTEM_PROMPT,
} from "@/lib/ai/prompts";
import { buildDeAiRewriteSystemPrompt } from "@/lib/ai/skills";
import { splitMarkdownForRewrite } from "@/lib/ai/chunk-text";
import { isEvaluationDraft } from "@/lib/draft-profile";
import {
  analyzeReadingTime,
  buildReadingTimeGeneratePrompt,
  buildReadingTimeRewritePrompt,
  ReadingProfile,
  resolveReadingProfile,
} from "@/lib/reading-time";
import { buildWechatNarrativeStylePrompt } from "@/lib/wechat-narrative-style";
import { buildSupplementaryNotesPrompt } from "@/lib/content-supplementary-notes";
import { runXiaohongshuTwoPassConversion } from "@/lib/ai/xiaohongshu-conversion";
import {
  buildXiaohongshuConversionPrompt,
  buildXiaohongshuOutlinePrompt,
} from "@/lib/ai/xiaohongshu-prompt";
import { buildCoverPromptRefinePrompt } from "@/lib/ai/cover-prompt-refine";
import { diffFacts, formatFactDiffForNotes } from "@/lib/fact-diff";
import {
  coverImageOutputSchema,
  coverPromptRefineOutputSchema,
  illustrationSuggestionsOutputSchema,
  researchDirectionsOutputSchema,
  rewriteOutputSchema,
  topicsOutputSchema,
  wechatArticleSchema,
  xiaohongshuOutlineSchema,
  xiaohongshuOutputSchema,
} from "@/lib/ai/schemas";
import { HotspotItem } from "@/lib/hotspots/types";
import {
  heuristicCoverSuggestions,
  normalizeCoverVariant,
  type CoverImageVariant,
} from "@/lib/illustrations/cover";
import {
  heuristicIllustrationSuggestions,
  normalizeIllustrationSuggestion,
} from "@/lib/illustrations/heuristic";
import {
  applyIllustrationSuggestionsToBody,
  countBodyIllustrationPlaceholders,
  prependCoverPlaceholder,
} from "@/lib/illustrations/enrich-article-media";
import { IMAGE_GPT_PROMPT_RULES } from "@/lib/illustrations/prompt-style";
import {
  buildCoverContextHints,
  COVER_GPT_PROMPT_RULES,
  isParvisBlindtestCover,
  appendCoverIconInstructions,
  enforceCoverAspectRatio,
} from "@/lib/illustrations/cover-prompt-style";
import { prepareBodyForIllustrationAnalysis } from "@/lib/illustrations/prepare-body";
import {
  GenerationHarness,
  PublishVoice,
  Topic,
  TopicDirection,
  WechatGenerateMode,
  XiaohongshuGenerationResult,
  XiaohongshuOutline,
} from "@/types/domain";

type WithLLM = { llm?: Partial<LLMClientSettings> | null };

type WechatArticleResult = {
  title: string;
  digest: string;
  coverCopy: string;
  body: string;
  cta: string;
  notes?: string;
  factDiff?: ReturnType<typeof diffFacts>;
  coverSummary?: string;
  coverVariants?: CoverImageVariant[];
  illustrationSummary?: string;
  illustrationInserted?: number;
};

export type { WechatGenerateMode };

function createBaseMessages(
  voice: PublishVoice,
  harness: GenerationHarness | null,
  context: { materials: string[]; historyTitles: string[] },
  taskPrompt: string
): LLMMessage[] {
  const messages: LLMMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: buildVoicePrompt({
        accountName: voice.accountName,
        voice: voice.voice,
        audience: voice.audience,
        style: voice.style,
        bannedExpressions: voice.bannedExpressions,
      }),
    },
  ];

  if (harness) {
    messages.push({
      role: "user",
      content: buildHarnessPrompt({
        section: harness.section,
        audienceFocus: harness.audienceFocus,
        goal: harness.goal,
        bannedExtra: harness.bannedExtra,
      }),
    });
  }

  messages.push({
    role: "user",
    content: buildContextPrompt({
      materials: context.materials,
      historyTitles: context.historyTitles,
      conversionNote: voice.conversionNote,
    }),
  });
  messages.push({ role: "user", content: taskPrompt });
  return messages;
}

export async function generateTopics(
  input: {
    voice: PublishVoice;
    harness: GenerationHarness;
    materials: string[];
    historyTitles: string[];
    count: number;
  } & WithLLM
) {
  const provider = getLLMProvider(input.llm);
  const messages = createBaseMessages(
    input.voice,
    input.harness,
    { materials: input.materials, historyTitles: input.historyTitles },
    `Task: generateTopics\n请输出 ${input.count} 条结构化选题，默认平台公众号，覆盖不同内容板块并避免重复。`
  );

  return provider.generateStructuredOutput(messages, topicsOutputSchema);
}

export async function generateResearchDirections(
  input: {
    voice: PublishVoice;
    harness: GenerationHarness;
    hotspot: Pick<HotspotItem, "id" | "title" | "url" | "summary" | "leverageHint">;
    materials: string[];
  } & WithLLM
) {
  const provider = getLLMProvider(input.llm);
  const messages = createBaseMessages(
    input.voice,
    input.harness,
    { materials: input.materials, historyTitles: [] },
    `Task: generateResearchDirections
基于下面这条 AI 相关热点，为当前账号人设输出：
1) leverageAngle：一句话说明如何蹭这个热点、又不偏离账号定位
2) directions：恰好 3 个不同切口的话题方向。每个方向要有 title、angle、whyNow、targetAudience、outline（4-6 条提纲）、coreViewpoint、section（四板块之一）、openingHook。
要求三个方向差异明显，避免同义重复。${buildHotspotPrompt(input.hotspot)}`
  );

  return provider.generateStructuredOutput(messages, researchDirectionsOutputSchema);
}

export async function generateWechatArticle(
  input: {
    voice: PublishVoice;
    harness: GenerationHarness;
    topic: Topic;
    materials: string[];
    hotspot?: Pick<HotspotItem, "title" | "url" | "summary"> | null;
    direction?: Pick<
      TopicDirection,
      "title" | "angle" | "whyNow" | "coreViewpoint" | "outline" | "leverageAngle"
    > | null;
  } & WithLLM
) {
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
    isEvaluation: /盲测|测评|测试/.test(input.topic.title),
  });
  extraPrompts.push(buildReadingTimeGeneratePrompt(readingProfile));
  extraPrompts.push(buildWechatNarrativeStylePrompt());

  const messages = createBaseMessages(
    input.voice,
    input.harness,
    { materials: input.materials, historyTitles: [input.topic.title] },
    `${extraPrompts.join("\n")}
Task: generateWechatArticle
基于选题“${input.topic.title}”生成公众号图文：title、digest、coverCopy、body、cta。正文结合热点背景但不过度蹭热点，尽量少用翻案腔和模型黑话。严格遵守上文阅读时长与叙事排版要求。`
  );

  return provider.generateStructuredOutput<WechatArticleResult>(messages, wechatArticleSchema);
}

export async function generateXiaohongshuArticle(
  input: {
    voice: PublishVoice;
    sourceContent: {
      id: string;
      title: string;
      digest?: string;
      body: string;
      cta?: string;
      supplementaryNotes?: string;
    };
  } & WithLLM
): Promise<XiaohongshuGenerationResult> {
  const provider = getLLMProvider(input.llm);
  const voiceForPrompt = { ...input.voice, conversionNote: undefined };
  const history = { materials: [] as string[], historyTitles: [input.sourceContent.title] };

  return runXiaohongshuTwoPassConversion({
    sourceContent: input.sourceContent,
    voice: input.voice,
    extractOutline: async () => {
      const messages = createBaseMessages(
        voiceForPrompt,
        null,
        history,
        buildXiaohongshuOutlinePrompt(input.sourceContent)
      );
      return provider.generateStructuredOutput<XiaohongshuOutline>(
        messages,
        xiaohongshuOutlineSchema
      );
    },
    writeArticle: async (outline) => {
      const messages = createBaseMessages(
        voiceForPrompt,
        null,
        history,
        buildXiaohongshuConversionPrompt({
          ...input.sourceContent,
          outline,
        })
      );
      return provider.generateStructuredOutput(messages, xiaohongshuOutputSchema);
    },
  });
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
  const readingProfile = resolveReadingProfile({
    section: input.topic.section,
    isEvaluation: isEvaluationDraft({
      topicId: input.topic.id,
      body: input.existingBody,
    }),
  });
  const rewritten = await deAiRewrite({
    original: input.existingBody,
    title: input.title ?? input.topic.title,
    llm: input.llm,
    preserveFacts: true,
    readingProfile,
    supplementaryNotes: input.supplementaryNotes,
  });
  const reading = analyzeReadingTime(rewritten.candidate, readingProfile);
  const factDiff = diffFacts(input.existingBody, rewritten.candidate);
  return {
    title: input.title ?? input.topic.title,
    digest: input.digest ?? "",
    coverCopy: input.coverCopy ?? "",
    body: rewritten.candidate,
    cta: input.cta ?? "",
    notes: [
      rewritten.notes,
      `完读约 ${reading.minutes} 分钟（${reading.statusLabel}）`,
      formatFactDiffForNotes(factDiff),
    ]
      .filter(Boolean)
      .join(" · "),
    factDiff,
  };
}

/** 出稿后自动去 AI 味；支持从零生成、仅润色、保留测评结构扩写 */
export async function generateWechatArticlePipeline(
  input: {
    voice: PublishVoice;
    harness: GenerationHarness;
    topic: Topic;
    materials: string[];
    hotspot?: Pick<HotspotItem, "title" | "url" | "summary"> | null;
    direction?: Pick<
      TopicDirection,
      "title" | "angle" | "whyNow" | "coreViewpoint" | "outline" | "leverageAngle"
    > | null;
    mode?: WechatGenerateMode;
    existingBody?: string;
    existingMeta?: { title?: string; digest?: string; coverCopy?: string; cta?: string };
    supplementaryNotes?: string;
  } & WithLLM
) {
  const mode = input.mode ?? "from_scratch";

  if (mode === "polish" && input.existingBody?.trim()) {
    return polishImportedDraft({
      voice: input.voice,
      topic: input.topic,
      existingBody: input.existingBody,
      title: input.existingMeta?.title,
      digest: input.existingMeta?.digest,
      coverCopy: input.existingMeta?.coverCopy,
      cta: input.existingMeta?.cta,
      supplementaryNotes: input.supplementaryNotes,
      llm: input.llm,
    });
  }

  if (mode === "preserve_structure" && input.existingBody?.trim()) {
    const readingProfile = resolveReadingProfile({
      section: input.topic.section,
      isEvaluation: isEvaluationDraft({
        topicId: input.topic.id,
        body: input.existingBody,
      }),
    });
    const rewritten = await deAiRewrite({
      original: input.existingBody,
      title: input.existingMeta?.title ?? input.topic.title,
      llm: input.llm,
      preserveFacts: true,
      readingProfile,
      supplementaryNotes: input.supplementaryNotes,
    });
    const reading = analyzeReadingTime(rewritten.candidate, readingProfile);
    const factDiff = diffFacts(input.existingBody, rewritten.candidate);
    return {
      title: input.existingMeta?.title ?? input.topic.title,
      digest: input.existingMeta?.digest ?? "",
      coverCopy: input.existingMeta?.coverCopy ?? "",
      body: rewritten.candidate,
      cta: input.existingMeta?.cta ?? "",
      notes:
        [
          rewritten.notes,
          `完读约 ${reading.minutes} 分钟（${reading.statusLabel}）`,
          formatFactDiffForNotes(factDiff),
        ]
          .filter(Boolean)
          .join(" · ") || "已在保留测评结构与数据前提下分段润色。",
      factDiff,
    };
  }

  const generated = await generateWechatArticle(input);
  const readingProfile = resolveReadingProfile({
    section: input.topic.section,
    isEvaluation: /盲测|测评|测试/.test(input.topic.title),
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
    isEvaluation: readingProfile === "evaluation" || /盲测|测评|测试/.test(input.topic.title),
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

/** 识别正文适合配图的位置，并生成可复制到 GPT 的配图提示词（不生图） */
export async function suggestIllustrations(
  input: {
    title: string;
    body: string;
    isEvaluation?: boolean;
  } & WithLLM
) {
  const provider = getLLMProvider(input.llm);
  const articleType = input.isEvaluation ? "测评/测试型长文" : "观点/方法论长文";
  const excerpt = prepareBodyForIllustrationAnalysis(input.body);

  const messages: LLMMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Task: suggestIllustrations
你是公众号图文编辑，负责为长文规划配图，但不直接生成图片。

文章类型：${articleType}
标题：${input.title}

请从正文中找出恰好 3 处最适合插入配图的位置。

输出 JSON 格式示例：
{
  "summary": "一句话总结配图策略",
  "suggestions": [
    {
      "id": "1",
      "placementLabel": "§02 数据对比段落后",
      "anchorSnippet": "从正文逐字摘录15-60字",
      "reason": "为何此处需要配图",
      "imageKind": "数据图表",
      "gptPrompt": "完整中文生图提示词...",
      "altText": "图片简短描述"
    }
  ]
}

imageKind 只能是：数据图表、流程示意图、概念插图、对比图、架构图

要求：
1. anchorSnippet 必须从正文原文逐字摘录，用于定位插入点。
2. gptPrompt 必须全文简体中文（见下方规范），可直接复制到 ChatGPT 生图。
3. gptPrompt 必须把 anchorSnippet 附近正文或表格中的关键数字逐条写进提示词，禁止只写「标注具体数字」等笼统句。
4. 不要虚构正文没有的数据。
5. 对比图/架构图中每个对象的图标须写清语义隐喻（地图层、流程图、盾牌等），禁止无含义几何图形。

${IMAGE_GPT_PROMPT_RULES}

--- 正文摘录 ---
${excerpt}`,
    },
  ];

  try {
    const raw = await provider.generateStructuredOutput<{
      summary?: string;
      suggestions: Array<{
        id?: string | number;
        placementLabel: string;
        anchorSnippet: string;
        reason: string;
        imageKind: string;
        gptPrompt: string;
        altText?: string;
      }>;
    }>(messages, illustrationSuggestionsOutputSchema);

    return {
      summary: raw.summary,
      suggestions: raw.suggestions.map((item, index) => normalizeIllustrationSuggestion(item, index)),
    };
  } catch {
    return heuristicIllustrationSuggestions(input.title, input.body);
  }
}

/** 生成公众号封面图 GPT 提示词（2.35:1，不生图） */
export async function suggestCoverImages(
  input: {
    title: string;
    digest?: string;
    coverCopy?: string;
    body?: string;
    isEvaluation?: boolean;
  } & WithLLM
) {
  const provider = getLLMProvider(input.llm);
  const excerpt = input.body ? prepareBodyForIllustrationAnalysis(input.body, 2500) : "";
  const articleType = input.isEvaluation ? "测评/测试型" : "观点/方法论";
  const parvisBlindtest = isParvisBlindtestCover({
    title: input.title,
    digest: input.digest,
    body: input.body,
  });
  const coverHints = buildCoverContextHints({
    title: input.title,
    digest: input.digest,
    body: input.body,
    isEvaluation: input.isEvaluation,
  });

  const messages: LLMMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Task: suggestCoverImages
你是公众号视觉编辑，负责生成头条封面图的 GPT 生图提示词（不直接生图）。

文章类型：${articleType}
标题：${input.title}
摘要：${input.digest || "（无）"}
封面短文案：${input.coverCopy || "（待生成，请根据标题提炼）"}

请输出恰好 1 套封面方案，写入 variants 数组仅一项。

输出 JSON 示例：
{
  "summary": "封面策略一句话",
  "variants": [
    {
      "id": "1",
      "styleLabel": "概念插画封面",
      "overlayText": "画面上可选的短文案",
      "gptPrompt": "完整中文生图提示词...",
      "altText": "公众号封面",
      "notes": "使用场景说明（可选）"
    }
  ]
}

要求：
1. 针对微信公众号头条封面：比例必须是 2.35:1（约 1472×624），安全区居中，两端可能被裁切。
2. 禁止写成 16:9 / 正文配图比例；gptPrompt 开头须写明「微信公众号头条封面图，比例 2.35:1」。
3. gptPrompt 必须全文简体中文，可直接复制到 ChatGPT 生图；画面构图与文字要求全部写进 gptPrompt，不要写进 altText。
4. altText 固定用短标签「公众号封面」，不要写成画面描述长句。
5. overlayText 建议 4-16 字，可与封面短文案一致或更精炼。
6. 测评文可突出 Agent 对比、数据或盲测结论；观点文突出核心隐喻。
7. 不要写实照片，不要满屏小字。
8. gptPrompt 必须为每个测评对象写明「图标画什么」（语义隐喻），禁止写「不同颜色的几何图标」等模糊描述。
9. 只输出一套最终方案，不要多路线备选。

${COVER_GPT_PROMPT_RULES}
${coverHints ? `\n${coverHints}` : ""}

${excerpt ? `--- 正文摘录 ---\n${excerpt}` : ""}`,
    },
  ];

  try {
    const raw = await provider.generateStructuredOutput<{
      summary?: string;
      variants: Array<{
        id?: string | number;
        styleLabel: string;
        overlayText: string;
        gptPrompt: string;
        altText?: string;
        notes?: string;
      }>;
    }>(messages, coverImageOutputSchema);

    return {
      summary: raw.summary,
      variants: appendCoverIconInstructions(
        [normalizeCoverVariant(raw.variants[0], 0)],
        { parvisBlindtest }
      ),
    };
  } catch {
    return heuristicCoverSuggestions(input);
  }
}

/** 按用户修改建议优化单套封面 GPT 提示词 */
export async function refineCoverPrompt(
  input: {
    title?: string;
    styleLabel?: string;
    overlayText?: string;
    gptPrompt: string;
    suggestion: string;
  } & WithLLM
) {
  const provider = getLLMProvider(input.llm);
  const refined = await provider.generateStructuredOutput(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildCoverPromptRefinePrompt(input) },
    ],
    coverPromptRefineOutputSchema
  );
  return {
    ...refined,
    gptPrompt: enforceCoverAspectRatio(refined.gptPrompt),
  };
}

export async function generateContentSchedule() {
  return {
    days: [7, 14, 30],
    strategy: "每周可混合 AI 通识、工具工作流、组织 AI 进化与行业观察，避免连续同板块。",
  };
}

export async function rewriteContentSection(
  input: {
    original: string;
    instruction:
      | "缩短内容"
      | "增强开场钩子"
      | "增加具体场景"
      | "降低营销感"
      | "降低 AI 味"
      | "重新生成 CTA";
    title?: string;
  } & WithLLM
) {
  if (input.instruction === "降低 AI 味") {
    return deAiRewrite({
      original: input.original,
      title: input.title,
      llm: input.llm,
    });
  }

  return {
    candidate: `${input.instruction}（建议稿）\n${input.original}`,
    notes: undefined as string | undefined,
  };
}

/** 使用 human-writing + khazix-writer 技能做去 AI 味改写 */
export async function deAiRewrite(
  input: {
    original: string;
    title?: string;
    preserveFacts?: boolean;
    readingProfile?: ReadingProfile;
    supplementaryNotes?: string;
  } & WithLLM
) {
  const profile =
    input.readingProfile ??
    resolveReadingProfile({ isEvaluation: input.preserveFacts });
  const chunks = splitMarkdownForRewrite(input.original);
  if (chunks.length <= 1) {
    return deAiRewriteSingle({ ...input, readingProfile: profile });
  }

  const parts: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const part = await deAiRewriteSingle({
      ...input,
      readingProfile: profile,
      original: chunks[i],
      title: `${input.title ?? "（无）"} · 第${i + 1}/${chunks.length}段`,
    });
    parts.push(part.candidate);
  }

  const merged = parts.join("\n\n");
  const reading = analyzeReadingTime(merged, profile);

  return {
    candidate: merged,
    notes: `长文已分 ${chunks.length} 段润色后合并。完读约 ${reading.minutes} 分钟（${reading.statusLabel}）。`,
  };
}

async function deAiRewriteSingle(
  input: {
    original: string;
    title?: string;
    preserveFacts?: boolean;
    readingProfile?: ReadingProfile;
    supplementaryNotes?: string;
  } & WithLLM
) {
  const provider = getLLMProvider(input.llm);
  const profile =
    input.readingProfile ??
    resolveReadingProfile({ isEvaluation: input.preserveFacts });
  const readingAnalysis = analyzeReadingTime(input.original, profile);
  const readingPrompt = buildReadingTimeRewritePrompt(readingAnalysis);
  const notesPrompt = buildSupplementaryNotesPrompt(input.supplementaryNotes);

  const factGuard = input.preserveFacts
    ? "\n\n硬性要求：保留全部数字、产品名、测试结论，不得改写数据；可合并编号章节为叙事段落，但不得删事实。"
    : "";

  const messages: LLMMessage[] = [
    {
      role: "system",
      content: `${buildDeAiRewriteSystemPrompt()}${factGuard}\n\n${readingPrompt}\n\n${buildWechatNarrativeStylePrompt()}${notesPrompt ? `\n\n${notesPrompt}` : ""}`,
    },
    {
      role: "user",
      content: `Task: deAiRewrite\n标题：${input.title ?? "（无）"}\n\n请按技能规则改写下面正文。${input.preserveFacts ? "这是测评稿片段，必须保留所有数据与事实。" : ""}\n\n---\n${input.original}`,
    },
  ];

  try {
    const result = await provider.generateStructuredOutput<{
      body: string;
      notes?: string;
    }>(messages, rewriteOutputSchema);
    return {
      candidate: result.body,
      notes: result.notes,
    };
  } catch {
    const text = await provider.generateText([
      ...messages,
      {
        role: "user",
        content:
          "请直接输出改写后的正文 Markdown，不要 JSON，不要解释，不要前后说明。",
      },
    ]);
    return {
      candidate: text.trim(),
      notes: "已使用纯文本模式润色（结构化输出失败时的兜底）。",
    };
  }
}
