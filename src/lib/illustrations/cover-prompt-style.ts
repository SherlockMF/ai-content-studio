/** 公众号封面 GPT 提示词规范（头条 2.35:1，与 IMAGE_SIZE_BY_PURPOSE.cover 对齐） */

import { BrandIconSlot } from "@/types/domain";
import { PUBLISHED_CONTENT_RULES } from "@/lib/ai/published-content-rules";

export const BRAND_ICON_SLOTS: BrandIconSlot[] = ["Parvis", "Codex", "Cola", "WorkBuddy"];

/** 微信头条封面比例；生图像素与 `IMAGE_SIZE_BY_PURPOSE.cover`（1472*624）一致 */
export const WECHAT_COVER_ASPECT_RATIO = "2.35:1";
export const WECHAT_COVER_SIZE_HINT = "1472×624";
export const WECHAT_COVER_RATIO_LABEL = `${WECHAT_COVER_ASPECT_RATIO}（约 ${WECHAT_COVER_SIZE_HINT}）`;
export const WECHAT_COVER_PROMPT_HEADER = `<!-- 公众号封面 GPT 提示词（简体中文，${WECHAT_COVER_RATIO_LABEL}）`;

export const COVER_GPT_PROMPT_RULES = `
封面生图提示词（${WECHAT_COVER_RATIO_LABEL}，安全区居中）额外要求：
1. gptPrompt 必须明确写出比例「${WECHAT_COVER_ASPECT_RATIO}」或尺寸「${WECHAT_COVER_SIZE_HINT}」；禁止写 16:9、1:1、3:4 等正文配图比例。
2. 这是头条封面，不是正文插图；不要套用正文配图构图。
3. 图标须有明确语义隐喻（地图层、流程闭环、账本、盾牌等），禁止无含义随机几何体。
4. 仅当上下文明确要求使用原品牌图标 reference 时，才写「直接使用用户上传的参考图」；否则不要要求用户附 logo PNG。
5. 禁止把产品名误画成无关品牌商标（例如把 Cola 画成可口可乐）。
6. 测评对比封面：分列展示对象时，每列「图标 + 名称 + 角色/关键词」；有分数则写出具体分数。
7. 主标题、副标题须写出完整中文，字少而大；数据类须写出具体数字（若正文有）。
${PUBLISHED_CONTENT_RULES}
`.trim();

/** 纠正封面提示词里误写成正文配图比例的情况 */
export function enforceCoverAspectRatio(gptPrompt: string): string {
  let text = gptPrompt.trim();
  if (!text) return text;

  text = text
    .replace(/16\s*[:：]\s*9/g, WECHAT_COVER_ASPECT_RATIO)
    .replace(/16\s*\/\s*9/g, WECHAT_COVER_ASPECT_RATIO)
    .replace(/约?\s*1280\s*[×xX*]\s*720/g, `约 ${WECHAT_COVER_SIZE_HINT}`)
    .replace(/约?\s*900\s*[×xX*]\s*383/g, `约 ${WECHAT_COVER_SIZE_HINT}`);

  const hasCoverAspect =
    /2\.35\s*[:：]\s*1/.test(text) || /1472\s*[×xX*]\s*624/.test(text);
  if (!hasCoverAspect) {
    text = `微信公众号头条封面图，比例 ${WECHAT_COVER_RATIO_LABEL}，安全区居中。${text}`;
  }
  return text;
}
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

/** 北港盲测稿 Agent 原图标视觉（按官方对比图，写入生图提示词） */
export const BLINDTEST_AGENT_VISUALS = `
各产品图标必须按下列原 logo 形态绘制（禁止换成无关几何体，禁止把 Cola 画成饮料罐）：
- Parvis（Auto）：深色近黑方底圆角图标，中央晶透立体字母「P」，有白色折射光纹；标签「工具箱+Copilot · 38 分」
- Codex+Skill：蓝紫有机云团形 logo，云内写 Codex，下方小角标 skills；标签「项目负责人 · 91 分」
- Cola（August / GLM）：白底圆角方卡上粗橙色圆环（两列可共用同一橙环图标）；August 标签「技术总工 · 90 分」，GLM 标签「方案规划师 · 75 分」
- WorkBuddy（Auto）：绿色圆角方底，白色线描猫/机器人头像（尖耳+两只圆角矩形眼）；标签「合规红队 · 67 分」
`.trim();

/** 小红书盲测对比图专用：五列卡片图标说明 */
export const BLINDTEST_XHS_ICON_PROMPT = `
若画面出现产品对比，必须使用以下原 logo 形态（与官方盲测对比图一致）：
1. Parvis：深色方底 + 晶透立体字母 P + 白色光纹
2. Codex：蓝紫云团形 + Codex 字样 + skills 角标
3. Cola August / Cola GLM：白底圆角方 + 粗橙色圆环（两列同图标）
4. WorkBuddy：绿色方底 + 白色线描猫/机器人头
禁止自造六边形、随机积木、饮料可乐罐。分数若出现须准确：Parvis 38、Codex 91、August 90、GLM 75、WorkBuddy 67。
`.trim();

export function isParvisBlindtestCover(input: { title?: string; body?: string; digest?: string }) {
  const text = `${input.title ?? ""} ${input.digest ?? ""} ${input.body?.slice(0, 500) ?? ""}`;
  return /Parvis.*盲测|盲测.*Parvis|城市规划 Agent 盲测/i.test(text);
}

export function isHarnessArticleCover(input: { title?: string; body?: string; digest?: string }) {
  if (isParvisBlindtestCover(input)) return false;
  const text = `${input.title ?? ""} ${input.digest ?? ""} ${input.body?.slice(0, 800) ?? ""}`;
  return /Harness|Agent\s*=\s*Model\s*\+\s*Harness|兑现率|Everything is a Plugin/i.test(text);
}

export function buildCoverContextHints(input: {
  title: string;
  digest?: string;
  body?: string;
  isEvaluation?: boolean;
}) {
  if (isParvisBlindtestCover(input)) {
    return `
本篇为 Parvis 城市规划 Agent 盲测。封面须体现「两轮测试」：
- 副标题：「第一轮 25 项专项 · 第二轮开放式 T25」
- 用户会在 ChatGPT 生图时自行上传 Parvis/Codex/Cola/WorkBuddy 四张原图标作为 attachment；gptPrompt 须写清直接使用参考图，禁止 AI 自造 logo。
- 四列分数：Parvis 38、Codex 91、August 90、WorkBuddy 67（Cola 列可注 GLM 75）。
${BLINDTEST_AGENT_VISUALS}
`.trim();
  }
  if (isHarnessArticleCover(input)) {
    return `
本篇为 DeepSeek Harness / Harness Engineering 观点文。封面须突出核心公式与金句：
- 主公式：「Agent = Model + Harness」
- 金句：「Model 决定上限，Harness 决定兑现率」
- 可用隐喻：大脑（Model）+ 工作台/工具/状态/验证闭环（Harness）；或插件模块拼装；禁止无含义几何体。
- 不要画 DeepSeek 品牌 logo；不要写成产品发布海报。
`.trim();
  }
  if (!input.isEvaluation) {
    return "";
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
