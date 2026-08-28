import { DEMO_CONTENT_ITEMS, DEMO_TOPICS } from "@/lib/mock-data";
import { ContentItem, ContentVersion, Topic } from "@/types/domain";

export const SEED_TOPIC_IDS = ["topic_gis", "topic_harness"] as const;
export const SEED_CONTENT_IDS = ["content_gis", "content_harness"] as const;

/** 种子稿内容变更时递增，触发 localStorage 同步 */
export const CURRENT_SEED_FINGERPRINT = "parvis-blindtest-v8-prompt-values";

const SEED_BY_TOPIC = new Map(
  DEMO_CONTENT_ITEMS.map((item) => [item.topicId, item] as const)
);

const SEED_BY_ID = new Map(DEMO_CONTENT_ITEMS.map((item) => [item.id, item] as const));

export function isSeedTopicId(topicId: string) {
  return (SEED_TOPIC_IDS as readonly string[]).includes(topicId);
}

export function getSeedContentByTopicId(topicId: string): ContentItem | undefined {
  return SEED_BY_TOPIC.get(topicId);
}

export function getSeedContentById(contentId: string): ContentItem | undefined {
  return SEED_BY_ID.get(contentId);
}

/** 正文明显被 AI 短稿覆盖时，自动恢复种子正文 */
export function maybeRestoreSeedContent(item: ContentItem): ContentItem {
  const seed = getSeedContentById(item.id) ?? getSeedContentByTopicId(item.topicId);
  if (!seed) return item;

  const seedLen = seed.body.length;
  const currentLen = item.body.length;
  const truncated = seedLen > 0 && currentLen < seedLen * 0.45;

  if (!truncated && item.source === "imported") return item;

  if (!truncated && item.source) return item;

  return {
    ...seed,
    status: item.status === "AI 草稿" ? seed.status : item.status,
    scheduledAt: item.scheduledAt ?? seed.scheduledAt,
    publishedAt: item.publishedAt ?? seed.publishedAt,
    updatedAt: item.updatedAt,
    source: "imported",
  };
}

export function inferContentSource(item: Pick<ContentItem, "id" | "topicId" | "source">): ContentItem["source"] {
  if (item.source) return item.source;
  if (
    (SEED_CONTENT_IDS as readonly string[]).includes(item.id) ||
    isSeedTopicId(item.topicId)
  ) {
    return "imported";
  }
  return "ai";
}

/** 将内置种子选题/稿件与代码库对齐（保留排期与已发布状态） */
export function syncBuiltinSeedArticles(state: {
  topics: Topic[];
  contentItems: ContentItem[];
  versions: ContentVersion[];
}) {
  const seedTopicMap = new Map(DEMO_TOPICS.map((topic) => [topic.id, topic] as const));
  const seedContentMap = new Map(DEMO_CONTENT_ITEMS.map((item) => [item.id, item] as const));

  const topics = state.topics.map((topic) => {
    const fresh = seedTopicMap.get(topic.id);
    if (!fresh) return topic;
    return { ...fresh, createdAt: topic.createdAt };
  });
  for (const fresh of DEMO_TOPICS) {
    if (!topics.some((topic) => topic.id === fresh.id)) {
      topics.push(fresh);
    }
  }

  const contentItems = state.contentItems.map((item) => {
    const fresh = seedContentMap.get(item.id);
    if (!fresh) return item;
    return {
      ...fresh,
      importBaseline: item.importBaseline,
      supplementaryNotes:
        item.supplementaryNotes !== undefined
          ? item.supplementaryNotes
          : fresh.supplementaryNotes,
      scheduledAt: item.scheduledAt ?? fresh.scheduledAt,
      status: item.status === "已发布" ? item.status : fresh.status,
      publishedAt: item.publishedAt ?? fresh.publishedAt,
      updatedAt: new Date().toISOString(),
    };
  });
  for (const fresh of DEMO_CONTENT_ITEMS) {
    if (!contentItems.some((item) => item.id === fresh.id)) {
      contentItems.push(fresh);
    }
  }

  const versions = state.versions.map((version) => {
    const fresh = seedContentMap.get(version.contentItemId);
    if (!fresh) return version;
    return { ...version, title: fresh.title, body: fresh.body };
  });

  return { topics, contentItems, versions };
}
