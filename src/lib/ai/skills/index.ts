import { HUMAN_WRITING_SKILL_PROMPT } from "./human-writing";
import { KHAZIX_WRITER_SKILL_PROMPT } from "./khazix-writer";

export const DE_AI_SKILL_SOURCES = [
  {
    id: "human-writing",
    name: "活人感写作",
    url: "https://github.com/KKKKhazix/human-writing",
  },
  {
    id: "khazix-writer",
    name: "khazix-writer 公众号长文方法论",
    url: "https://github.com/KKKKhazix/khazix-skills/tree/main/khazix-writer",
  },
] as const;

/** 出稿「降低 AI 味」合并技能 Prompt */
export function buildDeAiRewriteSystemPrompt() {
  return `
你是公众号图文改稿编辑。任务是降低 AI 味，保留原意与事实边界，不虚构新经历、企业名与数据。

依次遵守下面两套技能规则，冲突时以「活人感写作」硬禁令为准，文风节奏参考「khazix-writer」。

===== 技能 1：human-writing =====
${HUMAN_WRITING_SKILL_PROMPT}

===== 技能 2：khazix-writer =====
${KHAZIX_WRITER_SKILL_PROMPT}

输出要求：
- 只改写用户给出的正文（可保留 Markdown 结构，但尽量少用小标题堆砌）
- 不要解释你改了什么
- 不要输出内部检查清单
`.trim();
}

export { HUMAN_WRITING_SKILL_PROMPT, KHAZIX_WRITER_SKILL_PROMPT };
