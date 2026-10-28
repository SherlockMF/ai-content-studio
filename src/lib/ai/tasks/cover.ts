import { getLLMProvider } from "@/lib/ai/providers";
import { coverImageOutputSchema } from "@/lib/ai/schemas";
import { heuristicCoverSuggestions, normalizeCoverVariant } from "@/lib/illustrations/cover";
import {
  appendCoverIconInstructions,
  buildCoverContextHints,
  COVER_GPT_PROMPT_RULES,
  isParvisBlindtestCover,
} from "@/lib/illustrations/cover-prompt-style";
import { prepareBodyForIllustrationAnalysis } from "@/lib/illustrations/prepare-body";
import { buildStandaloneTaskMessages, withHeuristicFallback, type WithLLM } from "./shared";

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

  const messages = buildStandaloneTaskMessages(`Task: suggestCoverImages
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

${excerpt ? `--- 正文摘录 ---\n${excerpt}` : ""}`);

  return withHeuristicFallback(
    async () => {
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
    },
    () => heuristicCoverSuggestions(input)
  );
}
