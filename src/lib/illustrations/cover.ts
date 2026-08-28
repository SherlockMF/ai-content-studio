import {
  appendCoverIconInstructions,
  isParvisBlindtestCover,
  BLINDTEST_AGENT_VISUALS,
} from "@/lib/illustrations/cover-prompt-style";

export interface CoverImageVariant {
  id: string;
  styleLabel: string;
  overlayText: string;
  gptPrompt: string;
  altText: string;
  notes?: string;
}

export function normalizeCoverVariant(
  raw: {
    id?: string | number;
    styleLabel: string;
    overlayText: string;
    gptPrompt: string;
    altText?: string;
    notes?: string;
  },
  index: number
): CoverImageVariant {
  return {
    id: String(raw.id ?? `cover_${index + 1}`),
    styleLabel: raw.styleLabel,
    overlayText: raw.overlayText,
    gptPrompt: raw.gptPrompt,
    altText: raw.altText?.trim() || raw.styleLabel,
    notes: raw.notes,
  };
}

export function buildCoverImagePlaceholder(altText: string, gptPrompt: string) {
  return [
    `![${altText}](待替换-上传封面图后填链接)`,
    "",
    "<!-- 公众号封面 GPT 提示词（简体中文，2.35:1，建议 900×383）",
    gptPrompt,
    "-->",
  ].join("\n");
}

/** 封面图提示词本地兜底 */
export function heuristicCoverSuggestions(input: {
  title: string;
  digest?: string;
  coverCopy?: string;
  body?: string;
  isEvaluation?: boolean;
}) {
  const overlay = input.coverCopy?.trim() || input.title.slice(0, 24);
  const theme = input.isEvaluation ? "测评对比" : "观点概念";
  const parvisBlindtest = isParvisBlindtestCover(input);

  const base = [
    "微信公众号头条封面图，比例 2.35:1（约 900×383 像素），安全区居中，",
    "简约扁平信息图风格，浅色或低饱和背景，适合科技/专业公众号，",
    "不要写实照片，不要杂乱文字堆砌，不要随机几何图标。",
    `文章标题（须出现在画面上）：${input.title}。`,
    input.digest ? `摘要：${input.digest}` : "",
    `封面短文案（可少量出现在画面上）：${overlay}。`,
  ]
    .filter(Boolean)
    .join(" ");

  const comparePrompt = parvisBlindtest
    ? `${base} 四列对比卡片。每列上方直接使用用户上传的原图标 reference attachment（Parvis/Codex/Cola/WorkBuddy），下方英文名 + 中文角色 + 分数。主标题「城市规划 Agent 盲测」，副标题「第一轮 25 项专项 · 第二轮开放式 T25」。${BLINDTEST_AGENT_VISUALS}`
    : `${base} 左右或上下对比构图，每侧图标须为有含义符号，禁止无含义几何体。`;

  const variants = [
    {
      id: "cover_concept",
      styleLabel: "概念插画封面",
      overlayText: overlay,
      gptPrompt: parvisBlindtest
        ? `${base} 中央为北港片区抽象地图轮廓，四角落排列用户上传的原图标 reference（Parvis/Codex/Cola/WorkBuddy），主标题大字。`
        : `${base} 画面用有含义的扁平图标（地图层、流程节点、盾牌等），禁止无含义几何体，留白充足，标题区干净。`,
      altText: "概念插画风格公众号封面",
    },
    {
      id: "cover_compare",
      styleLabel: theme === "测评对比" ? "测评对比封面" : "对比结构封面",
      overlayText: overlay,
      gptPrompt: comparePrompt,
      altText: "对比结构公众号封面",
    },
    {
      id: "cover_data",
      styleLabel: "信息图封面",
      overlayText: overlay,
      gptPrompt: parvisBlindtest
        ? `${base} 横向条形图展示开放式盲测得分 Parvis 38、WorkBuddy 67、GLM 75、August 90、Codex 91；各条旁使用用户上传的原图标 reference。`
        : `${base} 中央简洁数据可视化，2-3 个关键数字，图标为有含义符号而非抽象几何。`,
      altText: "信息图风格公众号封面",
    },
  ].map((item, index) => normalizeCoverVariant(item, index));

  return {
    summary: parvisBlindtest
      ? "复制提示词到 ChatGPT 生图，并在对话中自行附上四张原图标 PNG。"
      : "已生成 3 套封面方向，复制提示词到 ChatGPT 生图后上传公众号。",
    variants: appendCoverIconInstructions(variants, { parvisBlindtest }),
  };
}
