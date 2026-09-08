import { isArchivedStatus, isPublishedLikeStatus } from "@/lib/content-status";
import { ContentItem, Topic } from "@/types/domain";

/** 选题页：仅点子池——尚无公众号稿件的选题 */
export function topicsWithoutWechatDraft(
  topics: Topic[],
  contentItems: ContentItem[]
): Topic[] {
  const wechatTopicIds = new Set(
    contentItems
      .filter((item) => item.platform === "wechat")
      .map((item) => item.topicId)
  );
  return topics.filter((topic) => !wechatTopicIds.has(topic.id));
}

/** 稿件页主列表：活跃公众号稿（非归档） */
export function activeWechatContents(contentItems: ContentItem[]): ContentItem[] {
  return contentItems
    .filter((item) => item.platform === "wechat" && !isArchivedStatus(item.status))
    .sort((a, b) => {
      const scheduleDiff = (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "");
      if (scheduleDiff !== 0) return scheduleDiff;
      return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
    });
}

/** 稿件页折叠区：已归档公众号稿 */
export function archivedWechatContents(contentItems: ContentItem[]): ContentItem[] {
  return contentItems
    .filter((item) => item.platform === "wechat" && isArchivedStatus(item.status))
    .sort((a, b) => (b.scheduledAt ?? b.updatedAt).localeCompare(a.scheduledAt ?? a.updatedAt));
}

export function contentListLabel(item: ContentItem) {
  if (isPublishedLikeStatus(item.status) && item.status !== "已归档") {
    return item.status;
  }
  return item.status;
}
