/** 正文配图 / 封面占位与提示词状态（用于稿件页角标） */

const IMAGE_PLACEHOLDER =
  /待替换|upload.*填链接|fill.*link|placeholder/i;

const BODY_ILLUSTRATION_PROMPT = /<!--\s*GPT 配图提示词/;
const COVER_PROMPT = /<!--\s*公众号封面 GPT 提示词/;
const COVER_IMAGE_PLACEHOLDER = /上传封面图后填链接/;

export interface IllustrationSlotStatus {
  /** 正文 markdown 图片位总数 */
  total: number;
  /** 已填入真实链接 */
  filled: number;
  /** 仍为占位符 */
  pending: number;
  /** 含 GPT 配图提示词注释的块 */
  withPrompt: number;
}

export interface CoverMediaStatus {
  hasCopy: boolean;
  hasPrompt: boolean;
  hasImage: boolean;
}

function isRealImageUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return false;
  return !IMAGE_PLACEHOLDER.test(trimmed);
}

/** 统计正文配图占位与提示词 */
export function analyzeIllustrationSlots(body: string): IllustrationSlotStatus {
  const imageRe = /!\[[^\]]*\]\(([^)]+)\)/g;
  let total = 0;
  let filled = 0;
  let pending = 0;

  for (const match of body.matchAll(imageRe)) {
    total += 1;
    if (isRealImageUrl(match[1])) filled += 1;
    else pending += 1;
  }

  const withPrompt = (body.match(new RegExp(BODY_ILLUSTRATION_PROMPT.source, "g")) ?? [])
    .length;

  return { total, filled, pending, withPrompt };
}

/** 「识别正文配图」按钮角标文案 */
export function formatIllustrationButtonHint(body: string): string | null {
  const { total, filled, pending, withPrompt } = analyzeIllustrationSlots(body);
  if (total === 0 && withPrompt === 0) return null;

  if (filled > 0 && pending === 0) {
    return `(已配图 ${filled})`;
  }

  if (withPrompt > 0 && pending > 0 && filled === 0) {
    return `(提示词已备 ${withPrompt} · 待传图 ${pending})`;
  }

  if (withPrompt > 0 && filled > 0 && pending > 0) {
    return `(已配图 ${filled} · 待传 ${pending})`;
  }

  if (withPrompt > 0) {
    return `(提示词已备 ${withPrompt})`;
  }

  if (pending > 0) {
    return `(待传图 ${pending})`;
  }

  return null;
}

export function analyzeCoverMedia(body: string, coverCopy?: string): CoverMediaStatus {
  const hasCopy = Boolean(coverCopy?.trim());
  const hasPrompt = COVER_PROMPT.test(body);
  const coverImageRe = /!\[[^\]]*\]\(([^)]+)\)/g;
  let hasImage = false;

  for (const match of body.matchAll(coverImageRe)) {
    if (COVER_IMAGE_PLACEHOLDER.test(match[0])) continue;
    if (isRealImageUrl(match[1])) {
      hasImage = true;
      break;
    }
  }

  if (!hasImage && COVER_IMAGE_PLACEHOLDER.test(body)) {
    // 有封面占位但尚未传图
  }

  return { hasCopy, hasPrompt, hasImage };
}

/** 封面区角标：文案 / 提示词 / 已配图 / 缺 */
export function formatCoverStatusHint(body: string, coverCopy?: string): string {
  const { hasCopy, hasPrompt, hasImage } = analyzeCoverMedia(body, coverCopy);

  if (hasImage) return "(已配图)";
  if (hasPrompt) return "(提示词已备)";
  if (hasCopy) return "(文案已备)";
  return "(缺)";
}
