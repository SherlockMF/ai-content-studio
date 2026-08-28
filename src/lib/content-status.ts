import { ContentStatus, Platform } from "@/types/domain";

export const CONTENT_STATUSES: ContentStatus[] = [
  "AI 草稿",
  "编辑中",
  "待质检",
  "待确认",
  "待发布",
  "已发布",
];

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
  编辑中: ["待质检"],
  待质检: ["待确认"],
  待确认: ["待发布"],
  待发布: ["已发布"],
  已发布: [],
};

export function getAllowedNextStatuses(status: ContentStatus): ContentStatus[] {
  return STATUS_FLOW[status];
}

export function canTransitionStatus(from: ContentStatus, to: ContentStatus) {
  return STATUS_FLOW[from].includes(to);
}
