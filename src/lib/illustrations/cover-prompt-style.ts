/** 公众号封面 GPT 提示词规范（2.35:1） */

import { BrandIconSlot } from "@/types/domain";

export const BRAND_ICON_SLOTS: BrandIconSlot[] = ["Parvis", "Codex", "Cola", "WorkBuddy"];

export const COVER_GPT_PROMPT_RULES = `
封面生图提示词（2.35:1，约 900×383，安全区居中）额外要求：
1. 用户会在 ChatGPT 生图时自行上传原图标参考图：必须直接使用 reference attachment（保持形状与配色，仅缩放排列），禁止 AI 重新设计 logo。
2. 若无参考图时才用「角色隐喻」（地图层、流程闭环、账本、盾牌等），禁止无含义随机几何体。
3. 禁止把 Cola 画成可口可乐 logo；禁止虚构与参考图不一致的品牌图标。
4. 测评对比封面：4 列卡片，每列「图标 + 英文名 + 中文角色 + 关键词/分数」。
5. 主标题、副标题须写出完整中文，字少而大；数据类须写出具体分数（若正文有）。
`.trim();

/** 追加到 GPT 生图提示词末尾：提醒用户在 ChatGPT 自行上传四张原图标 */
export const MANUAL_BRAND_ICON_APPENDIX = `
【使用原图标 — 必遵】
生图时请在 ChatGPT 中同时上传下列 4 张参考图（attachment），封面中直接排列这些原图标，禁止 AI 重新设计 logo：
- Parvis：桌面原图标
- Codex：桌面原图标
- Cola：桌面原图标（August/GLM 平台壳）
- WorkBuddy：桌面原图标

要求：保持参考图标的形状、颜色、比例，仅等比缩放排列；不要换成六边形/抽象几何体。
布局：四列卡片，每列上方一个原图标，下方英文名 + 中文角色 + 分数。
`.trim();

/** 北港盲测稿 Agent 视觉隐喻（无参考图时的兜底说明，写入 gptPrompt 正文） */
export const BLINDTEST_AGENT_VISUALS = `
若用户未附参考图，各列图标隐喻如下：
- Parvis（Auto）：叠层地图 + 计算器；标签「工具箱 · 专项强 · 38 分」
- Codex（GPT + Skill）：流程闭环图；标签「闭环 · 91 分」
- Cola：August 审计账本 + GLM 方案草图；标签「90 / 75 分」
- WorkBuddy（Auto）：盾牌 + 禁行标志；标签「合规 · 67 分」
`.trim();

export function isParvisBlindtestCover(input: { title?: string; body?: string; digest?: string }) {
  const text = `${input.title ?? ""} ${input.digest ?? ""} ${input.body?.slice(0, 500) ?? ""}`;
  return /Parvis.*盲测|盲测.*Parvis|城市规划 Agent 盲测/i.test(text);
}

export function buildCoverContextHints(input: {
  title: string;
  digest?: string;
  body?: string;
  isEvaluation?: boolean;
}) {
  if (!input.isEvaluation && !isParvisBlindtestCover(input)) {
    return "";
  }
  if (isParvisBlindtestCover(input)) {
    return `
本篇为 Parvis 城市规划 Agent 盲测。封面须体现「两轮测试」：
- 副标题：「第一轮 25 项专项 · 第二轮开放式 T25」
- 用户会在 ChatGPT 生图时自行上传 Parvis/Codex/Cola/WorkBuddy 四张原图标作为 attachment；gptPrompt 须写清直接使用参考图，禁止 AI 自造 logo。
- 四列分数：Parvis 38、Codex 91、August 90、WorkBuddy 67（Cola 列可注 GLM 75）。
${BLINDTEST_AGENT_VISUALS}
`.trim();
  }
  return "本篇为测评文：每个对比对象的图标须对应能力隐喻，禁止随机几何图标；若用户上传原图标 reference 则优先直接使用。";
}

export function appendCoverIconInstructions<
  T extends { gptPrompt: string; notes?: string },
>(variants: T[], options: { parvisBlindtest?: boolean }): T[] {
  if (!options.parvisBlindtest) return variants;
  const note = "复制后在 ChatGPT 生图时自行上传 Parvis/Codex/Cola/WorkBuddy 四张原图标 PNG。";
  return variants.map((item) => ({
    ...item,
    gptPrompt: `${item.gptPrompt.trim()}\n\n${MANUAL_BRAND_ICON_APPENDIX}`,
    notes: item.notes ? `${item.notes} · ${note}` : note,
  }));
}
