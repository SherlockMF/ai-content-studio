import { generateArticleImage } from "@/lib/ai/image/client";
import { XIAOHONGSHU_FIXED_VISUAL_DIRECTION, XIAOHONGSHU_NO_PAGE_BADGES } from "@/lib/ai/xiaohongshu-prompt";
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
    "风格硬性要求：小红书干货讲解幻灯片 / 信息图卡片；圆角信息块 + 小图标 + 可读中文大标题；暖米白底；与同组第1-3张讲解页同一风格。",
    "严禁：抽象几何拼贴、文具静物摄影、笔记本样机、名片堆叠、空洞 UI mockup、无文字壁纸、科幻光效、看不清字、把 Cola 画成饮料罐。",
    "竖版约 3:4，安全边距，手机滑动笔记多图观感。",
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
