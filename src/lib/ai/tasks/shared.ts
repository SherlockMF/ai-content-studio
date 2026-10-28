import type { LLMClientSettings } from "@/lib/ai/llm-settings";
import type { LLMMessage } from "@/lib/ai/providers/types";
import { buildContextPrompt, buildHarnessPrompt, buildVoicePrompt, SYSTEM_PROMPT } from "@/lib/ai/prompts";
import type { diffFacts } from "@/lib/fact-diff";
import type { CoverImageVariant } from "@/lib/illustrations/cover";
import type { GenerationHarness, PublishVoice } from "@/types/domain";

export type WithLLM = { llm?: Partial<LLMClientSettings> | null };

export type WechatArticleResult = {
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

/** 人设 + harness + 素材上下文 + 任务说明，按固定顺序组装 */
export function buildTaskMessages(
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

/** 不依赖人设上下文的独立任务（配图、封面） */
export function buildStandaloneTaskMessages(taskPrompt: string): LLMMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: taskPrompt },
  ];
}

/** 模型调用失败时回退到本地启发式结果，保证功能可用 */
export async function withHeuristicFallback<T>(
  run: () => Promise<T>,
  fallback: () => T | Promise<T>
): Promise<T> {
  try {
    return await run();
  } catch {
    return fallback();
  }
}

export function isEvaluationTitle(title: string) {
  return /盲测|测评|测试/.test(title);
}
