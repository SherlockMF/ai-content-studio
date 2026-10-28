import type { ContentItem, Platform, Topic } from "@/types/domain";
import { isFixedForAutoSchedule, isWeekday, toDateKey } from "@/lib/schedule-policy";
import { topicsWithoutWechatDraft } from "@/lib/workspace-lists";

type Candidate = {
  id: string; topicId: string; platform: Platform; title: string;
  section: string; tokens: Set<string>; priority: number; createdAt: string;
  content?: ContentItem; topic?: Topic;
};

function tokens(text: string) {
  const result = new Set(text.toLowerCase().match(/[a-z][a-z0-9]+/g) ?? []);
  for (const run of text.match(/[\p{Script=Han}]+/gu) ?? []) {
    for (let i = 0; i < run.length - 1; i++) result.add(run.slice(i, i + 2));
  }
  return result;
}

function similarity(a: Set<string>, b: Set<string>) {
  let overlap = 0;
  a.forEach(token => { if (b.has(token)) overlap++; });
  return overlap / Math.max(1, a.size + b.size - overlap);
}

/** 每个平台每天一篇；仅重排自动档期，旧档期默认视为手动保留。 */
export function planAutomaticSchedule(contentItems: ContentItem[], topics: Topic[], from = new Date()) {
  const topicMap = new Map(topics.map(topic => [topic.id, topic]));
  const pending: Candidate[] = [];
  const fixed: { date: string; candidate: Candidate }[] = [];
  const makeCandidate = (item?: ContentItem, topic?: Topic): Candidate => {
    const title = item?.title || topic?.title || "";
    const freshHotspot = Boolean(topic?.hotspotId) && from.getTime() - new Date(topic!.createdAt).getTime() < 7 * 86400000;
    return {
      id: item?.id ?? `topic:${topic!.id}`, topicId: item?.topicId ?? topic!.id,
      platform: item?.platform ?? "wechat", title, section: topic?.section ?? "",
      tokens: tokens(`${title} ${topic?.coreViewpoint ?? ""} ${item?.digest ?? ""}`),
      priority: (item?.body.trim() ? 0.7 : 0) + (item?.status === "待发布" ? 0.5 : 0) + (freshHotspot ? 1.2 : 0),
      createdAt: item?.createdAt ?? topic!.createdAt, content: item, topic,
    };
  };
  for (const item of contentItems) {
    const candidate = makeCandidate(item, topicMap.get(item.topicId));
    if (isFixedForAutoSchedule(item)) {
      const date = item.scheduledAt || item.publishedAt;
      if (date) fixed.push({ date: toDateKey(new Date(date)), candidate });
    } else pending.push(candidate);
  }
  for (const topic of topicsWithoutWechatDraft(topics, contentItems)) {
    pending.push(makeCandidate(undefined, topic));
  }
  const assignments = new Map<string, { date: string; reason: string }>();
  for (const platform of ["wechat", "xiaohongshu", "douyin"] as const) {
    const pool = pending.filter(item => item.platform === platform);
    const history = fixed.filter(item => item.candidate.platform === platform);
    const occupied = new Set(history.map(item => item.date));
    const cursor = new Date(from);
    cursor.setHours(12, 0, 0, 0);
    // 排期按日期占位，中午仅用于保存日期，不是当天排稿的截止时间。
    while (pool.length) {
      const key = toDateKey(cursor);
      if (isWeekday(cursor) && !occupied.has(key)) {
        const recent = history.filter(item => item.date < key).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
        const upcoming = history.filter(item => item.date > key).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 1);
        const score = (candidate: Candidate) => {
          let value = candidate.priority;
          recent.forEach((previous, index) => {
            const relation = similarity(candidate.tokens, previous.candidate.tokens);
            const weight = index === 0 ? 1 : 0.4;
            if (candidate.section && candidate.section === previous.candidate.section) value -= 1.8 * weight;
            value += (relation > 0.35 ? -3 : relation > 0.08 ? 0.6 : 0) * weight;
          });
          if (upcoming[0] && similarity(candidate.tokens, upcoming[0].candidate.tokens) > 0.35) value -= 1;
          return value;
        };
        pool.sort((a, b) => score(b) - score(a) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
        const chosen = pool.shift()!;
        const previous = recent[0]?.candidate;
        const relation = previous ? similarity(chosen.tokens, previous.tokens) : 0;
        const reason = previous
          ? chosen.section && chosen.section !== previous.section
            ? `与上一篇「${previous.title}」错开内容板块，兼顾稿件完成度与热点时效`
            : relation > 0.08 && relation <= 0.35
              ? `衔接「${previous.title}」的相关主题，兼顾相似题材间隔`
              : "结合题材间隔、稿件完成度与可用工作日安排"
          : "优先考虑稿件完成度与热点时效，安排到可用工作日";
        assignments.set(chosen.id, { date: cursor.toISOString(), reason });
        history.push({ date: key, candidate: chosen });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return {
    contentItems: contentItems.map(item => {
      const plan = assignments.get(item.id);
      return plan ? { ...item, scheduledAt: plan.date, scheduleMode: "auto" as const, scheduleReason: plan.reason } : item;
    }),
    topics: topics.map(topic => {
      const article = contentItems.find(item => item.topicId === topic.id && item.platform === "wechat");
      const plan = assignments.get(article?.id ?? `topic:${topic.id}`);
      return { ...topic, suggestedScheduledAt: plan?.date ?? article?.scheduledAt ?? null,
        scheduleReason: plan?.reason ?? (article?.scheduledAt ? "沿用稿件已确定的排期" : undefined) };
    }),
  };
}
