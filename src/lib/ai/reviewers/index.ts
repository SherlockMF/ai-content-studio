import { getLLMProvider } from "@/lib/ai/providers";
import { LLMClientSettings } from "@/lib/ai/llm-settings";
import { SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { buildSupplementaryNotesPrompt } from "@/lib/content-supplementary-notes";
import { reviewOutputSchema } from "@/lib/ai/schemas";

export async function reviewContent(input: {
  title: string;
  body: string;
  targetAudience: string;
  supplementaryNotes?: string;
  llm?: Partial<LLMClientSettings> | null;
}) {
  const provider = getLLMProvider(input.llm);
  const notesPrompt = buildSupplementaryNotesPrompt(input.supplementaryNotes);

  return provider.generateStructuredOutput(
    [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Task: reviewContent
请对以下公众号图文做发布前质检，输出 score（0–100）和 issues 列表。
${notesPrompt ? `\n${notesPrompt}\n` : ""}
检查维度（每条 issue 填 dimension / severity / suggestion）：
1. 事实与数据：测评稿中的数字、产品名、结论是否自洽，有无明显遗漏或矛盾
2. 结构可读：开头是否结论前置，段落是否过长，有无报告腔或重复论述
3. AI 味与套话：翻案腔、空洞形容词、营销腔、过多引用块或列表堆砌
4. 受众匹配：${input.targetAudience} 能否读懂，专业术语是否必要且可理解
5. 发布就绪：摘要与标题是否匹配正文，有无未替换的配图占位符、待办语

severity：high=发布前必须改，medium=建议改，low=可选优化
标题：${input.title}
正文：
${input.body}`,
      },
    ],
    reviewOutputSchema
  );
}
