import { PUBLISHED_CONTENT_RULES } from "@/lib/ai/published-content-rules";

export const SYSTEM_PROMPT = `
你是 AI 领域内容创作者与编辑，为公众号图文与选题输出结构化内容。
边界要求：
1. 不虚构真实企业名称、客户成功案例、具体经营数据。
2. 不承诺使用 AI 一定降本增效。
3. 避免空洞 AI 套话、过度营销和大量感叹号。
4. 若缺少素材支持，仅在内部备注中说明，不将“缺少个人观点支持”等编辑提醒写进发布内容；假设案例用“示例场景”标注。
5. 首期默认面向公众号图文：标题清晰、摘要克制、正文可读、少硬广。
6. 文风参考活人感写作：判断从正面下，少用翻案腔（不是A而是B）和报告腔；句子先交主干，长短句有高低差。
7. 关注阅读时长：理想完读 8–18 分钟（视文章类型），文首 30 秒可扫读结论，避免重复论述。
8. 公众号排版偏叙事：短段落、结论前置、少章节编号；数据进句子或表格；测评稿保留全部事实与数字。段落间距由排版层统一空一行，不要在段落开头手打空格。
${PUBLISHED_CONTENT_RULES}
`;

export { buildWechatNarrativeStylePrompt } from "@/lib/wechat-narrative-style";

export function buildVoicePrompt(input: {
  accountName: string;
  voice: string;
  audience: string;
  style: string;
  bannedExpressions: string;
}) {
  return `
账号名称：${input.accountName}
人设：${input.voice}
目标受众：${input.audience}
表达风格：${input.style}
禁止表达：${input.bannedExpressions}
`;
}

export function buildHarnessPrompt(input: {
  section: string;
  audienceFocus: string;
  goal: string;
  bannedExtra: string;
}) {
  return `
本次出稿 harness：
内容板块：${input.section}
受众侧重：${input.audienceFocus}
内容目标：${input.goal}
额外禁止表达：${input.bannedExtra || "无"}
`;
}

export function buildHotspotPrompt(input: {
  title: string;
  summary?: string;
  url: string;
  leverageAngle?: string;
  leverageHint?: string;
}) {
  return `
关联热点：
标题：${input.title}
链接：${input.url}
摘要：${input.summary || "（无摘要）"}
蹭热点角度：${input.leverageAngle || input.leverageHint || "（待生成）"}
`;
}

export function buildDirectionPrompt(input: {
  title: string;
  angle: string;
  whyNow: string;
  coreViewpoint: string;
  outline: string[];
}) {
  return `
选定话题方向：
标题：${input.title}
切口：${input.angle}
为什么现在写：${input.whyNow}
核心观点：${input.coreViewpoint}
结构提纲：
${input.outline.map((item, index) => `${index + 1}. ${item}`).join("\n")}
`;
}

export function buildContextPrompt(context: {
  materials: string[];
  historyTitles: string[];
  conversionNote?: string;
}) {
  return `
知识库与知识条目摘录：
${context.materials.join("\n") || "（暂无启用素材）"}

历史选题（避免重复）：
${context.historyTitles.join("\n") || "（暂无）"}

转化备注：
${context.conversionNote || "无"}
`;
}
