export const XIAOHONGSHU_LOCAL_FOLDERS = [
  "xiaohongshu-harness",
  "xiaohongshu-blindtest",
] as const;

export type XiaohongshuLocalFolder = (typeof XIAOHONGSHU_LOCAL_FOLDERS)[number];

export type ImportedLocalImage = {
  index: number;
  role: string;
  fileName: string;
  url: string;
};

const FILE_RE = /^(\d{2})-(cover|content|ending)\.png$/i;

export function resolveLocalFolderHint(input: {
  title?: string;
  body?: string;
}): XiaohongshuLocalFolder {
  const text = `${input.title ?? ""} ${input.body ?? ""}`;
  if (/Parvis|盲测|WorkBuddy|Codex/i.test(text)) return "xiaohongshu-blindtest";
  return "xiaohongshu-harness";
}

export function parseLocalImageFileName(fileName: string): {
  index: number;
  role: string;
} | null {
  const match = FILE_RE.exec(fileName);
  if (!match) return null;
  return { index: Number(match[1]), role: match[2].toLowerCase() };
}

export function mergeImportedUrlsIntoImagePlan<
  T extends { index: number; imageUrl?: string; imageError?: string },
>(imagePlan: T[], imported: ImportedLocalImage[]): T[] {
  const byIndex = new Map(imported.map((item) => [item.index, item.url]));
  return imagePlan.map((image) => {
    const url = byIndex.get(image.index);
    if (!url) return image;
    return { ...image, imageUrl: url, imageError: undefined };
  });
}
