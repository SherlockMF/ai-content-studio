import {
  isCascadeSchedulable,
  isWeekday,
  scheduleDateKey,
  startOfDay,
  toDateKey,
  toNoonIso,
} from "@/lib/schedule-policy";
import { ContentItem } from "@/types/domain";
import { isPublishedLikeStatus } from "@/lib/content-status";

export { isCascadeSchedulable, isWeekdayDateKey, toDateKey } from "@/lib/schedule-policy";

/** 对齐到当周周日 00:00（列顶 = 周日，与贡献图一致） */
export function startOfWeekSunday(date: Date) {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** 从 from（含当天）起找最近的工作日，再往后连续 count 个工作日 */
export function nextWeekdays(from: Date, count: number): Date[] {
  const cursor = startOfDay(from);
  const result: Date[] = [];
  while (result.length < count) {
    if (isWeekday(cursor)) {
      result.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export function occupiedScheduleKeys(contentItems: ContentItem[]): Set<string> {
  const keys = new Set<string>();
  contentItems.forEach((item) => {
    if (!item.scheduledAt) return;
    keys.add(scheduleDateKey(item.scheduledAt));
  });
  return keys;
}

/** 下一个尚未占用的工作日 ISO（中午），今天是工作日且空闲则用今天 */
export function allocateNextWeekday(contentItems: ContentItem[], from = new Date()): string {
  const occupied = occupiedScheduleKeys(contentItems);
  const candidates = nextWeekdays(from, 260);
  for (const day of candidates) {
    const key = toDateKey(day);
    if (!occupied.has(key)) return toNoonIso(day);
  }
  return toNoonIso(candidates[candidates.length - 1]);
}

/** 从 from 起取 count 个工作日，可跳过 occupied（如已发布稿占用的日期） */
export function nextFreeWeekdays(
  from: Date,
  count: number,
  occupied: Set<string> = new Set()
): Date[] {
  const cursor = startOfDay(from);
  const result: Date[] = [];
  let guard = 0;
  while (result.length < count && guard < 800) {
    if (isWeekday(cursor)) {
      const key = toDateKey(cursor);
      if (!occupied.has(key)) result.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return result;
}

function dateKeyPlusOneDay(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + 1);
  return date;
}

function lockedScheduleKeys(contentItems: ContentItem[], exceptIds: Set<string> = new Set()) {
  const keys = new Set<string>();
  for (const item of contentItems) {
    if (exceptIds.has(item.id)) continue;
    if (!item.scheduledAt) continue;
    // 已发布 / 已归档 / 非可顺延稿的日期视为占用，不可被挤占
    if (!isCascadeSchedulable(item)) {
      keys.add(scheduleDateKey(item.scheduledAt));
    }
  }
  return keys;
}

/**
 * 锁定一篇稿到指定工作日；其余「原排期 ≥ 该日」的可顺延稿按原顺序排到该日之后。
 * 更早的稿保持不动。lockedDateKey 为 null 时取消该稿排期，其余从 from 起重排。
 */
export function applyScheduleWithCascade(
  contentItems: ContentItem[],
  input: { lockedId: string; lockedDateKey: string | null; from?: Date }
): ContentItem[] {
  const now = new Date().toISOString();
  const from = input.from ?? new Date();
  const locked = contentItems.find((item) => item.id === input.lockedId);
  if (!locked) return contentItems;

  const nextLocked: ContentItem = {
    ...locked,
    scheduledAt: input.lockedDateKey
      ? new Date(`${input.lockedDateKey}T12:00:00`).toISOString()
      : null,
    updatedAt: now,
  };

  if (!input.lockedDateKey) {
    const withoutLockedSchedule = contentItems.map((item) =>
      item.id === input.lockedId ? nextLocked : item
    );
    return remapCascadeSchedules(withoutLockedSchedule, from);
  }

  const oldDateKey = locked.scheduledAt?.slice(0, 10) ?? null;
  const toDelay = contentItems
    .filter((item) => {
      if (item.id === input.lockedId) return false;
      if (!isCascadeSchedulable(item) || !item.scheduledAt) return false;
      const key = item.scheduledAt.slice(0, 10);
      if (key >= input.lockedDateKey!) return true;
      // 锁定日往后挪时，夹在旧日与新日之间的稿也要顺延
      if (oldDateKey && input.lockedDateKey! > oldDateKey && key >= oldDateKey) return true;
      return false;
    })
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));

  const occupied = lockedScheduleKeys(contentItems, new Set([input.lockedId, ...toDelay.map((i) => i.id)]));
  occupied.add(input.lockedDateKey);
  // 更早且不动的可顺延稿日期也占坑
  for (const item of contentItems) {
    if (item.id === input.lockedId) continue;
    if (toDelay.some((d) => d.id === item.id)) continue;
    if (!item.scheduledAt) continue;
    if (isCascadeSchedulable(item)) occupied.add(item.scheduledAt.slice(0, 10));
  }

  const days = nextFreeWeekdays(dateKeyPlusOneDay(input.lockedDateKey), toDelay.length, occupied);
  const remapped = new Map(
    toDelay.map((item, index) => [
      item.id,
      {
        ...item,
        scheduledAt: toNoonIso(
          days[index] ?? days[days.length - 1] ?? dateKeyPlusOneDay(input.lockedDateKey!)
        ),
        updatedAt: now,
      } satisfies ContentItem,
    ])
  );

  return contentItems.map((item) => {
    if (item.id === input.lockedId) return nextLocked;
    return remapped.get(item.id) ?? item;
  });
}

/** 删除或批量变更后：可顺延稿按原顺序从 from 起排到连续空闲工作日 */
export function remapCascadeSchedules(
  contentItems: ContentItem[],
  from = new Date()
): ContentItem[] {
  const now = new Date().toISOString();
  const movable = contentItems
    .filter((item) => isCascadeSchedulable(item) && Boolean(item.scheduledAt))
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  if (movable.length === 0) return contentItems;

  const occupied = lockedScheduleKeys(contentItems);
  const days = nextFreeWeekdays(from, movable.length, occupied);
  const remapped = new Map(
    movable.map((item, index) => [
      item.id,
      {
        ...item,
        scheduledAt: toNoonIso(days[index] ?? days[days.length - 1] ?? from),
        updatedAt: now,
      } satisfies ContentItem,
    ])
  );
  return contentItems.map((item) => remapped.get(item.id) ?? item);
}

/** 拖拽重排后：按顺序映射到从「今天及以后最近工作日」起的连续工作日 */
export function remapToConsecutiveWeekdays(orderedItems: ContentItem[], from = new Date()) {
  const days = nextWeekdays(from, Math.max(orderedItems.length, 1));
  return orderedItems.map((item, index) => ({
    ...item,
    scheduledAt: toNoonIso(days[index] ?? days[days.length - 1]),
    updatedAt: new Date().toISOString(),
  }));
}

export function formatScheduleLabel(iso: string | null | undefined) {
  if (!iso) return "未排期";
  const date = new Date(iso);
  const week = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
  return `${date.getMonth() + 1}/${date.getDate()} 周${week}`;
}

export type ScheduleHeatCell = {
  dateKey: string;
  date: Date;
  items: ContentItem[];
};

export function getScheduleHeatTone(items: ContentItem[]): "empty" | "scheduled" | "published" {
  if (items.some((item) => isPublishedLikeStatus(item.status))) return "published";
  if (items.some((item) => item.body.trim())) return "scheduled";
  return "empty";
}

export function getScheduleHeatCounts(items: ContentItem[]) {
  return items.reduce(
    (counts, item) => {
      if (!item.scheduledAt) return counts;
      if (isPublishedLikeStatus(item.status)) counts.published++;
      else if (item.body.trim()) counts.scheduled++;
      return counts;
    },
    { published: 0, scheduled: 0 }
  );
}

export type ScheduleMonthLabel = {
  weekIndex: number;
  label: string;
};

/** 构建排期热力图：每列 7 天（日→六），有 scheduledAt 的稿件点亮 */
export function buildScheduleHeatmap(
  contentItems: ContentItem[],
  options?: { anchor?: Date; pastWeeks?: number; futureWeeks?: number }
) {
  const anchor = startOfDay(options?.anchor ?? new Date());
  const pastWeeks = options?.pastWeeks ?? 8;
  const futureWeeks = options?.futureWeeks ?? 12;

  const scheduled = contentItems.filter((item) => item.scheduledAt);
  let rangeStart = startOfWeekSunday(
    new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - pastWeeks * 7)
  );
  let rangeEnd = startOfWeekSunday(
    new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + futureWeeks * 7)
  );
  rangeEnd = new Date(rangeEnd);
  rangeEnd.setDate(rangeEnd.getDate() + 6);

  for (const item of scheduled) {
    const day = startOfDay(new Date(item.scheduledAt!));
    const weekStart = startOfWeekSunday(day);
    if (weekStart < rangeStart) rangeStart = weekStart;
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (weekEnd > rangeEnd) rangeEnd = weekEnd;
  }

  const byDate = new Map<string, ContentItem[]>();
  for (const item of scheduled) {
    const key = item.scheduledAt!.slice(0, 10);
    const list = byDate.get(key) ?? [];
    list.push(item);
    byDate.set(key, list);
  }
  for (const list of byDate.values()) {
    list.sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  }

  const weeks: ScheduleHeatCell[][] = [];
  const cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    const week: ScheduleHeatCell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(cursor);
      date.setDate(cursor.getDate() + i);
      const dateKey = toDateKey(date);
      week.push({
        dateKey,
        date,
        items: byDate.get(dateKey) ?? [],
      });
    }
    weeks.push(week);
    cursor.setDate(cursor.getDate() + 7);
  }

  const monthLabels: ScheduleMonthLabel[] = [];
  let lastMonth = -1;
  weeks.forEach((week, weekIndex) => {
    const month = week[0]?.date.getMonth() ?? -1;
    if (month !== lastMonth && week[0]) {
      monthLabels.push({
        weekIndex,
        label: `${week[0].date.getMonth() + 1}月`,
      });
      lastMonth = month;
    }
  });

  return { weeks, monthLabels, byDate };
}
