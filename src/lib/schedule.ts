import { ContentItem } from "@/types/domain";

const FRIDAY = 5;

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toNoonIso(date: Date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

/** 从 from（含当天）起找最近的周五，再往后连续 count 个周五 */
export function nextFridays(from: Date, count: number): Date[] {
  const start = startOfDay(from);
  const first = new Date(start);
  const delta = (FRIDAY - first.getDay() + 7) % 7;
  first.setDate(first.getDate() + delta);

  const result: Date[] = [];
  for (let i = 0; i < count; i++) {
    const day = new Date(first);
    day.setDate(first.getDate() + i * 7);
    result.push(day);
  }
  return result;
}

export function occupiedFridayKeys(contentItems: ContentItem[]): Set<string> {
  const keys = new Set<string>();
  contentItems.forEach((item) => {
    if (!item.scheduledAt) return;
    keys.add(item.scheduledAt.slice(0, 10));
  });
  return keys;
}

export function isFridayDateKey(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getDay() === FRIDAY;
}

/** 下一个尚未占用的周五 ISO（中午），今天是周五且空闲则用今天 */
export function allocateNextFriday(contentItems: ContentItem[], from = new Date()): string {
  const occupied = occupiedFridayKeys(contentItems);
  const candidates = nextFridays(from, 52);
  for (const friday of candidates) {
    const key = toDateKey(friday);
    if (!occupied.has(key)) return toNoonIso(friday);
  }
  return toNoonIso(candidates[candidates.length - 1]);
}

/** 拖拽重排后：按顺序映射到从「今天及以后最近周五」起的连续周五 */
export function remapToConsecutiveFridays(orderedItems: ContentItem[], from = new Date()) {
  const fridays = nextFridays(from, Math.max(orderedItems.length, 1));
  return orderedItems.map((item, index) => ({
    ...item,
    scheduledAt: toNoonIso(fridays[index] ?? fridays[fridays.length - 1]),
    updatedAt: new Date().toISOString(),
  }));
}

export function formatFridayLabel(iso: string | null | undefined) {
  if (!iso) return "未排期";
  const date = new Date(iso);
  const week = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
  return `${date.getMonth() + 1}/${date.getDate()} 周${week}`;
}
