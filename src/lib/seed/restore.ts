import { DEMO_CONTENT_ITEMS, DEMO_TOPICS } from "@/lib/mock-data";
import { normalizeContentStatus } from "@/lib/content-status";
import { ORG_ARCHITECTURE_SERIES } from "@/lib/seed/org-architecture-series";
import { ContentItem, ContentVersion, Topic } from "@/types/domain";

export const SEED_TOPIC_IDS = [
  "topic_gis",
  "topic_harness",
  ...ORG_ARCHITECTURE_SERIES.map((article) => `topic_org_${article.id}`),
] as const;

export const SEED_CONTENT_IDS = [
  "content_gis",
  "content_harness",
  ...ORG_ARCHITECTURE_SERIES.map((article) => `content_org_${article.id}`),
] as const;

/** 曾误回退为「待发布」的已发布种子稿；组织系列初稿不在此列 */
const LEGACY_ARCHIVED_SEED_CONTENT_IDS = ["content_gis", "content_harness"] as const;

/**
 * 种子稿内容变更时递增，触发 localStorage 同步。
 * org-series-from-0907-v1：组织系列从 2026-09-07 起按 01→06 顺序排工作日。
 */
export const CURRENT_SEED_FINGERPRINT = "org-series-from-0907-v1";

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
  // 小红书稿天然短于公众号种子长文，绝不能用同选题种子覆盖
  if (item.platform === "xiaohongshu" || item.xiaohongshu) {
    return { ...item, status: normalizeContentStatus(item.status) };
  }

  const seed = getSeedContentById(item.id) ?? getSeedContentByTopicId(item.topicId);
  if (!seed) return { ...item, status: normalizeContentStatus(item.status) };
  if (seed.platform !== "wechat") {
    return { ...item, status: normalizeContentStatus(item.status) };
  }

  const seedLen = seed.body.length;
  const currentLen = item.body.length;
  const truncated = seedLen > 0 && currentLen < seedLen * 0.45;

  if (!truncated && item.source === "imported") {
    return { ...item, status: normalizeContentStatus(item.status) };
  }

  if (!truncated && item.source) {
    return { ...item, status: normalizeContentStatus(item.status) };
  }

  const status = normalizeContentStatus(item.status);
  return {
    ...seed,
    wechatLayout: item.wechatLayout ?? seed.wechatLayout,
    status: status === "AI 草稿" ? normalizeContentStatus(seed.status) : status,
    scheduledAt: item.scheduledAt ?? seed.scheduledAt,
    publishedAt: item.publishedAt ?? seed.publishedAt,
    updatedAt: item.updatedAt,
    source: "imported",
  };
}

/** 从版本历史找回被误删/覆盖的小红书稿件 */
export function restoreOrphanedXiaohongshuFromVersions(input: {
  contentItems: ContentItem[];
  versions: ContentVersion[];
}): ContentItem[] {
  const existingIds = new Set(input.contentItems.map((item) => item.id));
  const latestByContentId = new Map<string, ContentVersion>();

  for (const version of input.versions) {
    if (!version.xiaohongshu) continue;
    const current = latestByContentId.get(version.contentItemId);
    if (!current || version.versionNumber > current.versionNumber) {
      latestByContentId.set(version.contentItemId, version);
    }
  }

  const restored: ContentItem[] = [];
  for (const [contentId, version] of latestByContentId) {
    if (existingIds.has(contentId) || !version.xiaohongshu) continue;
    const source =
      input.contentItems.find(
        (item) =>
          item.platform === "wechat" && item.id === version.xiaohongshu?.sourceContentId
      ) ?? getSeedContentById(version.xiaohongshu.sourceContentId);
    const activeTone = version.xiaohongshu.activeTone;
    const activeVariant = version.xiaohongshu.variants[activeTone];
    restored.push({
      id: contentId,
      workspaceId: source?.workspaceId ?? "ws_demo",
      topicId: source?.topicId ?? "topic_unknown",
      platform: "xiaohongshu",
      source: "ai",
      title: activeVariant?.title ?? version.title,
      body: activeVariant?.body ?? version.body,
      digest: version.digest,
      coverCopy: version.coverCopy ?? version.xiaohongshu.imagePlan[0]?.overlayText,
      cta: activeVariant?.cta ?? version.cta,
      supplementaryNotes: version.supplementaryNotes,
      status: "编辑中",
      createdAt: version.createdAt,
      updatedAt: version.createdAt,
      xiaohongshu: version.xiaohongshu,
    });
  }

  return restored.length > 0 ? [...input.contentItems, ...restored] : input.contentItems;
}

export function inferContentSource(
  item: Pick<ContentItem, "id" | "topicId" | "source">
): ContentItem["source"] {
  if (item.source) return item.source;
  if (
    (SEED_CONTENT_IDS as readonly string[]).includes(item.id) ||
    isSeedTopicId(item.topicId)
  ) {
    return "imported";
  }
  return "ai";
}

/**
 * 一次性纠正：种子两篇用户已确认发布，但被旧同步逻辑打回「待发布」。
 * 仅对仍停在待发布/待确认的种子稿生效，之后生命周期完全由用户状态决定。
 */
export function repairSeedPublishLifecycle(item: ContentItem): ContentItem {
  const status = normalizeContentStatus(item.status);
  if (!(LEGACY_ARCHIVED_SEED_CONTENT_IDS as readonly string[]).includes(item.id)) {
    return { ...item, status };
  }
  if (status === "待发布" || status === "待确认") {
    return {
      ...item,
      status: "已归档",
      publishedAt: item.publishedAt ?? new Date().toISOString(),
    };
  }
  return { ...item, status };
}

/** 将内置种子选题/稿件与代码库对齐（永不覆盖用户生命周期状态） */
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
    if (!fresh) return { ...item, status: normalizeContentStatus(item.status) };
    const status = normalizeContentStatus(item.status);
    return {
      ...fresh,
      importBaseline: item.importBaseline,
      wechatLayout: item.wechatLayout ?? fresh.wechatLayout,
      supplementaryNotes:
        item.supplementaryNotes !== undefined
          ? item.supplementaryNotes
          : fresh.supplementaryNotes,
      // 组织系列排期随指纹强制对齐；其余稿件保留用户排期
      scheduledAt: item.id.startsWith("content_org_")
        ? (fresh.scheduledAt ?? item.scheduledAt)
        : (item.scheduledAt ?? fresh.scheduledAt),
      status,
      publishedAt: item.publishedAt ?? fresh.publishedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      source: item.source ?? fresh.source,
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

  return {
    topics,
    contentItems: contentItems.map(repairSeedPublishLifecycle),
    versions,
  };
}
