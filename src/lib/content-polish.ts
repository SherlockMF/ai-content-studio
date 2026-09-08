import type { ContentVersion } from "@/types/domain";

/** 从持久化版本历史读取润色记录；普通编辑不清除已润色标记。 */
export function latestPolishByContent(
  versions: Pick<ContentVersion, "contentItemId" | "changeSource" | "createdAt">[]
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const version of versions) {
    if (version.changeSource !== "ai_rewrite") continue;
    if (!result[version.contentItemId] || result[version.contentItemId] < version.createdAt) {
      result[version.contentItemId] = version.createdAt;
    }
  }
  return result;
}
