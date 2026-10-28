import { getLLMProvider } from "@/lib/ai/providers";
import { illustrationSuggestionsOutputSchema } from "@/lib/ai/schemas";
import {
  heuristicIllustrationSuggestions,
  normalizeIllustrationSuggestion,
} from "@/lib/illustrations/heuristic";
import { prepareBodyForIllustrationAnalysis } from "@/lib/illustrations/prepare-body";
import { IMAGE_GPT_PROMPT_RULES } from "@/lib/illustrations/prompt-style";
import { buildStandaloneTaskMessages, withHeuristicFallback, type WithLLM } from "./shared";

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

  const messages = buildStandaloneTaskMessages(`Task: suggestIllustrations
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
${excerpt}`);

  return withHeuristicFallback(
    async () => {
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
    },
    () => heuristicIllustrationSuggestions(input.title, input.body)
  );
}
