import type { ContentItem } from "@/types/domain";

export interface ProjectDraftOverlay {
  id: string;
  /** 匹配公众号标题子串 */
  titleIncludes: string;
  platform: "wechat";
  /** public 下可 fetch 的正文路径 */
  bodyUrl: string;
}

/** 项目内可自动灌入浏览器草稿的配图正文（刷新后识别） */
export const PROJECT_DRAFT_OVERLAYS: ProjectDraftOverlay[] = [
  {
    id: "ai-task-cost",
    titleIncludes: "AI 项目到底赚不赚钱",
    platform: "wechat",
    bodyUrl: "/draft-overlays/ai-task-cost.body.md",
  },
];

/** 当前稿仍是待替换占位，或尚未包含项目正文里的本地配图时，应灌入 */
export function shouldApplyDraftOverlay(currentBody: string, overlayBody: string) {
  if (/待替换-公众号配图|待替换-上传图片|placeholder/i.test(currentBody)) {
    return true;
  }
  const assetUrls = [
    ...overlayBody.matchAll(/\/article-assets\/[A-Za-z0-9_.-]+/g),
  ].map((m) => m[0]);
  if (!assetUrls.length) return false;
  return assetUrls.some((url) => !currentBody.includes(url));
}

export function applyDraftOverlayToItems(
  items: ContentItem[],
  overlay: ProjectDraftOverlay,
  overlayBody: string
): { items: ContentItem[]; applied: boolean } {
  let applied = false;
  const next = items.map((item) => {
    if (item.platform !== overlay.platform) return item;
    if (!String(item.title || "").includes(overlay.titleIncludes)) return item;
    if (!shouldApplyDraftOverlay(item.body || "", overlayBody)) return item;
    applied = true;
    return {
      ...item,
      body: overlayBody,
      updatedAt: new Date().toISOString(),
    };
  });
  return { items: next, applied };
}
