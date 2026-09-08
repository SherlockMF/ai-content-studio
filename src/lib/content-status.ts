import { ContentStatus, Platform } from "@/types/domain";

export const CONTENT_STATUSES: ContentStatus[] = [
  "AI 草稿",
  "编辑中",
  "待质检",
  "待确认",
  "待发布",
  "公众号已发布",
  "小红书已发布",
  "已归档",
];

/** 列表排序：数值越大越靠后；已归档沉底 */
const STATUS_SORT_RANK: Record<ContentStatus, number> = {
  "AI 草稿": 1,
  编辑中: 2,
  待质检: 3,
  待确认: 4,
  待发布: 5,
  公众号已发布: 6,
  小红书已发布: 7,
  已归档: 8,
};

export const PLATFORM_OPTIONS: Array<{ value: Platform; label: string }> = [
  { value: "wechat", label: "公众号" },
  { value: "douyin", label: "抖音" },
  { value: "xiaohongshu", label: "小红书" },
];

export function getPlatformLabel(platform: Platform) {
  return PLATFORM_OPTIONS.find((item) => item.value === platform)?.label ?? platform;
}

const STATUS_FLOW: Record<ContentStatus, ContentStatus[]> = {
  "AI 草稿": ["编辑中"],
  编辑中: ["待质检", "待发布"],
  待质检: ["待确认", "编辑中"],
  待确认: ["待发布", "编辑中"],
  待发布: ["公众号已发布", "小红书已发布", "已归档"],
  公众号已发布: ["已归档", "小红书已发布"],
  小红书已发布: ["已归档", "公众号已发布"],
  已归档: [],
};

export function getAllowedNextStatuses(status: ContentStatus): ContentStatus[] {
  return STATUS_FLOW[status];
}

export function canTransitionStatus(from: ContentStatus, to: ContentStatus) {
  return STATUS_FLOW[from].includes(to);
}

/** 兼容旧版「已发布」→ 已归档 */
export function normalizeContentStatus(status: string | null | undefined): ContentStatus {
  if (status === "已发布") return "已归档";
  if (status && (CONTENT_STATUSES as string[]).includes(status)) {
    return status as ContentStatus;
  }
  return "编辑中";
}

export function isArchivedStatus(status: ContentStatus): boolean {
  return status === "已归档";
}

/** 已对外发布（含归档） */
export function isPublishedLikeStatus(status: ContentStatus): boolean {
  return (
    status === "公众号已发布" ||
    status === "小红书已发布" ||
    status === "已归档"
  );
}

/** 标这些状态时应写入 publishedAt */
export function shouldStampPublishedAt(status: ContentStatus): boolean {
  return isPublishedLikeStatus(status);
}

/** 需要发布检查通过后才能进入的状态 */
export function requiresPublishChecks(status: ContentStatus): boolean {
  return status === "待发布" || isPublishedLikeStatus(status);
}

export function statusSortRank(status: ContentStatus): number {
  return STATUS_SORT_RANK[status] ?? 2;
}

export function publishedStatusForPlatform(platform: Platform): ContentStatus {
  if (platform === "xiaohongshu") return "小红书已发布";
  return "公众号已发布";
}

export function compareByWorkbenchOrder(
  a: { status: ContentStatus; scheduledAt?: string | null; updatedAt?: string; createdAt?: string },
  b: { status: ContentStatus; scheduledAt?: string | null; updatedAt?: string; createdAt?: string }
): number {
  const rankDiff = statusSortRank(a.status) - statusSortRank(b.status);
  if (rankDiff !== 0) return rankDiff;
  const scheduleDiff = (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? "");
  if (scheduleDiff !== 0) return scheduleDiff;
  const updatedDiff = (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
  if (updatedDiff !== 0) return updatedDiff;
  return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
}
