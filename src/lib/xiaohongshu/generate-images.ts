import { generateArticleImage } from "@/lib/ai/image/client";
import {
  XIAOHONGSHU_FIXED_VISUAL_DIRECTION,
  XIAOHONGSHU_NO_PAGE_BADGES,
  XIAOHONGSHU_RENDER_STYLE_RULES,
} from "@/lib/xiaohongshu/visual-rules";
import { BLINDTEST_XHS_ICON_PROMPT } from "@/lib/illustrations/cover-prompt-style";
import type { XiaohongshuImagePrompt } from "@/types/domain";

export function isBlindtestXiaohongshuPlan(imagePlan: XiaohongshuImagePrompt[]) {
  const text = imagePlan.map((item) => `${item.overlayText} ${item.prompt}`).join("\n");
  return /Parvis|Codex|WorkBuddy|Cola|盲测|August|GLM/i.test(text);
}

export function buildXiaohongshuRenderPrompt(
  image: XiaohongshuImagePrompt,
  visualDirection: string,
  options?: { forceBlindtestIcons?: boolean }
) {
  const overlay = image.overlayText.replace(/Everything is a Plugin/gi, "插件化拼装");
  const basePrompt = image.prompt.replace(/Everything is a Plugin/gi, "插件化拼装");
  const useBlindtestIcons =
    options?.forceBlindtestIcons || isBlindtestXiaohongshuPlan([image]);
  const brandIcons = useBlindtestIcons ? `\n${BLINDTEST_XHS_ICON_PROMPT}` : "";

  return [
    visualDirection.trim() || XIAOHONGSHU_FIXED_VISUAL_DIRECTION,
    basePrompt,
    `必须把这些中文大字清楚写在画面上（占画面主要阅读区，禁止用乱码线代替文字）：${overlay}`,
    ...XIAOHONGSHU_RENDER_STYLE_RULES,
    brandIcons,
    XIAOHONGSHU_NO_PAGE_BADGES,
  ]
    .filter(Boolean)
    .join("\n");
}

export type XiaohongshuImageProgress = {
  index: number;
  total: number;
  status: "start" | "ok" | "error";
  message?: string;
};

export async function fillXiaohongshuImagePlan(
  imagePlan: XiaohongshuImagePrompt[],
  options: {
    visualDirection: string;
    onlyMissing?: boolean;
    forceBlindtestIcons?: boolean;
    onProgress?: (event: XiaohongshuImageProgress) => void;
    onImage?: (image: XiaohongshuImagePrompt) => void;
  }
): Promise<XiaohongshuImagePrompt[]> {
  const total = imagePlan.length;
  const next: XiaohongshuImagePrompt[] = [];
  const forceBlindtestIcons =
    options.forceBlindtestIcons ?? isBlindtestXiaohongshuPlan(imagePlan);

  for (const image of imagePlan) {
    if (options.onlyMissing && image.imageUrl) {
      next.push({ ...image, imageError: undefined });
      continue;
    }

    options.onProgress?.({ index: image.index, total, status: "start" });
    try {
      const prompt = buildXiaohongshuRenderPrompt(image, options.visualDirection, {
        forceBlindtestIcons,
      });
      const { url } = await generateArticleImage({
        prompt,
        purpose: "xiaohongshu",
      });
      next.push({
        ...image,
        imageUrl: url,
        imageError: undefined,
      });
      options.onProgress?.({ index: image.index, total, status: "ok" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "生图失败";
      next.push({
        ...image,
        imageUrl: undefined,
        imageError: message,
      });
      options.onProgress?.({
        index: image.index,
        total,
        status: "error",
        message,
      });
    }
    options.onImage?.(next[next.length - 1]);
  }

  return next;
}

export function countMissingXiaohongshuImages(imagePlan: XiaohongshuImagePrompt[]) {
  return imagePlan.filter((item) => !item.imageUrl).length;
}
