import { splitMarkdownForRewrite } from "@/lib/ai/chunk-text";
import { getLLMProvider } from "@/lib/ai/providers";
import type { LLMMessage } from "@/lib/ai/providers/types";
import { rewriteOutputSchema } from "@/lib/ai/schemas";
import { buildDeAiRewriteSystemPrompt } from "@/lib/ai/skills";
import { buildSupplementaryNotesPrompt } from "@/lib/content-supplementary-notes";
import { isEvaluationDraft } from "@/lib/draft-profile";
import { diffFacts, formatFactDiffForNotes } from "@/lib/fact-diff";
import {
  analyzeReadingTime,
  buildReadingTimeRewritePrompt,
  type ReadingProfile,
  resolveReadingProfile,
} from "@/lib/reading-time";
import { buildWechatNarrativeStylePrompt } from "@/lib/wechat-narrative-style";
import type { Topic } from "@/types/domain";
import type { WithLLM } from "./shared";

type RewriteInput = {
  original: string;
  title?: string;
  preserveFacts?: boolean;
  readingProfile?: ReadingProfile;
  supplementaryNotes?: string;
} & WithLLM;

/** 使用 human-writing + khazix-writer 技能做去 AI 味改写 */
export async function deAiRewrite(input: RewriteInput) {
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

async function deAiRewriteSingle(input: RewriteInput) {
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

/** 保留事实润色已有稿件（导入稿润色 / 保留测评结构），附完读时长与事实差异 */
export async function rewriteExistingDraft(
  input: {
    topic: Topic;
    existingBody: string;
    title?: string;
    digest?: string;
    coverCopy?: string;
    cta?: string;
    supplementaryNotes?: string;
    emptyNotesFallback?: string;
  } & WithLLM
) {
  const readingProfile = resolveReadingProfile({
    section: input.topic.section,
    isEvaluation: isEvaluationDraft({
      topicId: input.topic.id,
      body: input.existingBody,
    }),
  });
  const title = input.title ?? input.topic.title;
  const rewritten = await deAiRewrite({
    original: input.existingBody,
    title,
    llm: input.llm,
    preserveFacts: true,
    readingProfile,
    supplementaryNotes: input.supplementaryNotes,
  });
  const reading = analyzeReadingTime(rewritten.candidate, readingProfile);
  const factDiff = diffFacts(input.existingBody, rewritten.candidate);
  const notes = [
    rewritten.notes,
    `完读约 ${reading.minutes} 分钟（${reading.statusLabel}）`,
    formatFactDiffForNotes(factDiff),
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    title,
    digest: input.digest ?? "",
    coverCopy: input.coverCopy ?? "",
    body: rewritten.candidate,
    cta: input.cta ?? "",
    notes: input.emptyNotesFallback ? notes || input.emptyNotesFallback : notes,
    factDiff,
  };
}
