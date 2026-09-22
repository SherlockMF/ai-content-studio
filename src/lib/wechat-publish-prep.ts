import type { ContentSource } from "@/types/domain";
import { analyzeIllustrationSlots } from "@/lib/content-media-status";

/** AI 从零出稿已跑过 deAiRewrite；有 ai_rewrite 记录也视为已去 AI 味。 */
export function shouldSkipDeAi(input: {
  source: ContentSource | undefined;
  polishedAt: string | undefined;
}): boolean {
  return input.source === "ai" || Boolean(input.polishedAt);
}

export function hasWechatBodyImages(body: string): boolean {
  return analyzeIllustrationSlots(body).total > 0;
}

export function formatMediaStepToast(input: {
  hasImages: boolean;
  failures: string[];
}): string {
  if (!input.hasImages) return "补图：无图";
  if (input.failures.length) {
    return `文案已保存，${input.failures.length} 张配图未完成：${input.failures.join("；")}`;
  }
  return "配图已检查并保存，匹配的原图已保留";
}
