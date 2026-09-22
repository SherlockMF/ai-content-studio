import type { ContentItem, XiaohongshuImagePrompt } from "@/types/domain";

export function imagePlanSignature(image: XiaohongshuImagePrompt) {
  return JSON.stringify([image.index, image.role, image.objective, image.overlayText, image.composition, image.prompt]);
}

/** 只写回原稿件、原图片方案的结果，保留期间编辑过的文字和其他图片。 */
export function mergeGeneratedImage(current: ContentItem, original: ContentItem, result: XiaohongshuImagePrompt): ContentItem {
  if (current.id !== original.id || !current.xiaohongshu || !original.xiaohongshu) return current;
  if (current.xiaohongshu.visualDirection !== original.xiaohongshu.visualDirection) return current;
  const expected = original.xiaohongshu.imagePlan.find(image => image.index === result.index);
  const actual = current.xiaohongshu.imagePlan.find(image => image.index === result.index);
  if (!expected || !actual || imagePlanSignature(actual) !== imagePlanSignature(expected) || actual.imageUrl !== expected.imageUrl) return current;
  return { ...current, updatedAt: new Date().toISOString(), xiaohongshu: { ...current.xiaohongshu,
    imagePlan: current.xiaohongshu.imagePlan.map(image => image.index === result.index
      ? { ...image, imageUrl: result.imageUrl, imageError: result.imageError } : image),
  } };
}
