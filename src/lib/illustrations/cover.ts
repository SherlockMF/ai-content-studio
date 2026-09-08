import {
  appendCoverIconInstructions,
  enforceCoverAspectRatio,
  isHarnessArticleCover,
  isParvisBlindtestCover,
  BLINDTEST_AGENT_VISUALS,
  WECHAT_COVER_PROMPT_HEADER,
  WECHAT_COVER_RATIO_LABEL,
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
    gptPrompt: enforceCoverAspectRatio(raw.gptPrompt),
    altText: raw.altText?.trim() || raw.styleLabel,
    notes: raw.notes,
  };
}

export const COVER_PLACEHOLDER_ALT = "公众号封面";

export function buildCoverImagePlaceholder(_altText: string, gptPrompt: string) {
  // 正文只放短占位；真正的生图提示词在下方 HTML 注释里
  return [
    `![${COVER_PLACEHOLDER_ALT}](待替换-上传封面图后填链接)`,
    "",
    WECHAT_COVER_PROMPT_HEADER,
    enforceCoverAspectRatio(gptPrompt),
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
  const harnessArticle = !parvisBlindtest && isHarnessArticleCover(input);

  const base = [
    `微信公众号头条封面图，比例 ${WECHAT_COVER_RATIO_LABEL}，安全区居中，`,
    "简约扁平信息图风格，浅色或低饱和背景，适合科技/专业公众号，",
    "不要写实照片，不要杂乱文字堆砌，不要随机几何图标，不要写成 16:9 正文配图。",
    `文章标题（须出现在画面上）：${input.title}。`,
    input.digest ? `摘要：${input.digest}` : "",
    `封面短文案（可少量出现在画面上）：${overlay}。`,
  ]
    .filter(Boolean)
    .join(" ");

  const primary = {
    id: "cover_main",
    styleLabel: parvisBlindtest
      ? "盲测封面"
      : harnessArticle
        ? "Harness 概念封面"
        : theme === "测评对比"
          ? "测评封面"
          : "概念封面",
    overlayText: overlay,
    gptPrompt: parvisBlindtest
      ? `${base} 中央为北港片区抽象地图轮廓，四角落排列用户上传的原图标 reference（Parvis/Codex/Cola/WorkBuddy），主标题大字。`
      : harnessArticle
        ? `${base} 中央大公式「Agent = Model + Harness」；下方金句「Model 决定上限，Harness 决定兑现率」；旁侧用大脑与工作台/插件模块隐喻，禁止无含义几何体，留白充足。`
        : input.isEvaluation
          ? `${base} 左右或上下对比构图，突出测评对象差异；每侧图标须为有含义符号，禁止无含义几何体。${BLINDTEST_AGENT_VISUALS}`
          : `${base} 画面用有含义的扁平图标，禁止无含义几何体，留白充足，标题区干净。`,
    altText: "公众号封面",
  };

  return {
    summary: parvisBlindtest
      ? "复制提示词到 ChatGPT 生图，并附上四张原图标。"
      : "封面提示词已生成，可复制到 ChatGPT 生图。",
    variants: appendCoverIconInstructions([normalizeCoverVariant(primary, 0)], {
      parvisBlindtest,
    }),
  };
}
