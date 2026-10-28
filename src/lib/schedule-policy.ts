import { isArchivedStatus, isPublishedLikeStatus } from "@/lib/content-status";
import type { ContentItem } from "@/types/domain";

/** 排期共用规则：日期键、工作日、哪些稿件的档期不可被挪动 */

export function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 档期统一存为当天中午，避免时区换算跨日 */
export function toNoonIso(date: Date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

export function isWeekday(date: Date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

export function isWeekdayDateKey(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return isWeekday(new Date(y, m - 1, d));
}

export function scheduleDateKey(iso: string) {
  return iso.slice(0, 10);
}

/** 自动排期不会挪动：已发布、手动锁定、或非自动模式下已有日期的旧稿 */
export function isFixedForAutoSchedule(item: ContentItem) {
  const published = isPublishedLikeStatus(item.status) || Boolean(item.publishedAt);
  return published || item.scheduleMode === "manual" || Boolean(item.scheduledAt && item.scheduleMode !== "auto");
}

/** 可被手动排期顺延：公众号、非手动锁定、未归档且尚未发布 */
export function isCascadeSchedulable(item: ContentItem) {
  if (item.platform !== "wechat" || item.scheduleMode === "manual") return false;
  if (isArchivedStatus(item.status)) return false;
  if (isPublishedLikeStatus(item.status)) return false;
  return true;
}
