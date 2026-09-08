import { WECHAT_COVER_RATIO_LABEL } from "@/lib/illustrations/cover-prompt-style";

export function buildCoverPromptRefinePrompt(input: {
  title?: string;
  styleLabel?: string;
  overlayText?: string;
  gptPrompt: string;
  suggestion: string;
}): string {
  return `Task: refineCoverPrompt
根据用户修改建议，优化下面的公众号封面 GPT 生图提示词。只改写提示词，不生图。

输出 JSON：
{
  "gptPrompt": "优化后的完整中文生图提示词",
  "overlayText": "可选，若短文案也需调整则返回 4-16 字"
}

硬性要求：
1. 保留微信公众号头条封面 ${WECHAT_COVER_RATIO_LABEL}、安全区居中、简体中文；禁止改成 16:9 正文配图比例。
2. 落实用户修改建议，但不要偏离原风格意图（styleLabel）。
3. 不要写实照片、不要满屏小字、不要虚构原文未支持的产品效果。
4. gptPrompt 必须可直接复制到 ChatGPT 生图。
5. 若建议未要求改短文案，可省略 overlayText。

文章标题：${input.title || "（无）"}
方案风格：${input.styleLabel || "（无）"}
当前短文案：${input.overlayText || "（无）"}
用户修改建议：${input.suggestion}

--- 原提示词 ---
${input.gptPrompt}
--- 原提示词结束 ---`;
}
