import type {
  ContentItem,
  XiaohongshuDraftData,
  XiaohongshuGenerationResult,
  XiaohongshuTone,
  XiaohongshuVariant,
} from "@/types/domain";
import { XIAOHONGSHU_FIXED_VISUAL_DIRECTION } from "@/lib/ai/xiaohongshu-prompt";
import { clampXiaohongshuBody, clampXiaohongshuTitle } from "@/lib/xiaohongshu/limits";
import {
  extractHashtagsFromText,
  foldXiaohongshuVariant,
  foldXiaohongshuVariants,
} from "@/lib/xiaohongshu/note-body";

function syncCommonFields(content: ContentItem, data: XiaohongshuDraftData): ContentItem {
  const activeVariant = data.variants[data.activeTone];

  return {
    ...content,
    title: activeVariant.title,
    body: activeVariant.body,
    cta: activeVariant.cta,
    coverCopy: data.imagePlan[0]?.overlayText,
    xiaohongshu: data,
  };
}

export function createXiaohongshuContent(input: {
  source: ContentItem;
  result: XiaohongshuGenerationResult;
  now: string;
  existing?: ContentItem;
}): ContentItem {
  const { source, result, now, existing } = input;
  const data: XiaohongshuDraftData = {
    sourceContentId: source.id,
    activeTone: "professional",
    variants: foldXiaohongshuVariants(result.variants),
    visualDirection: XIAOHONGSHU_FIXED_VISUAL_DIRECTION,
    imagePlan: result.imagePlan,
  };
  const content: ContentItem = existing
    ? {
        ...existing,
        workspaceId: source.workspaceId,
        topicId: source.topicId,
        platform: "xiaohongshu",
        source: "ai",
        updatedAt: now,
      }
    : {
        id: `xhs_${source.id}`,
        workspaceId: source.workspaceId,
        topicId: source.topicId,
        platform: "xiaohongshu",
        source: "ai",
        title: "",
        body: "",
        status: "AI 草稿",
        createdAt: now,
        updatedAt: now,
      };

  return syncCommonFields(content, data);
}

export function saveXiaohongshuVariant(
  content: ContentItem,
  tone: XiaohongshuTone,
  variant: XiaohongshuVariant,
  now: string
): ContentItem {
  if (!content.xiaohongshu) {
    return content;
  }

  // 编辑时只同步字数截断与从正文提取话题，不做 fold（避免 trim 干扰输入）
  const nextVariant: XiaohongshuVariant = {
    title: clampXiaohongshuTitle(variant.title),
    body: clampXiaohongshuBody(variant.body),
    cta: "",
    hashtags: extractHashtagsFromText(variant.body),
  };

  const data: XiaohongshuDraftData = {
    ...content.xiaohongshu,
    activeTone: tone,
    variants: {
      ...content.xiaohongshu.variants,
      [tone]: nextVariant,
    },
  };

  return syncCommonFields({ ...content, updatedAt: now }, data);
}

export function normalizeXiaohongshuContent(content: ContentItem): ContentItem {
  if (content.platform !== "xiaohongshu" || !content.xiaohongshu) {
    return content;
  }

  return syncCommonFields(content, {
    ...content.xiaohongshu,
    variants: foldXiaohongshuVariants(content.xiaohongshu.variants),
    visualDirection: XIAOHONGSHU_FIXED_VISUAL_DIRECTION,
  });
}
