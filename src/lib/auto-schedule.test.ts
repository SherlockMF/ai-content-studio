import assert from "node:assert/strict";
import test from "node:test";
import { planAutomaticSchedule } from "./auto-schedule";
import { DEMO_TOPICS } from "./mock-data";
import type { ContentItem, Topic } from "@/types/domain";

const from = new Date(2026, 8, 14, 9);
const topics: Topic[] = ["a", "b", "c"].map((id, i) => ({ ...DEMO_TOPICS[0], id, title: `组织变革${id}`, section: "组织 AI 进化", createdAt: `2026-09-0${i + 1}T00:00:00Z` }));
const items: ContentItem[] = topics.map(topic => ({ id: topic.id, topicId: topic.id, workspaceId: "ws", title: topic.title, platform: "wechat", source: "imported", body: "正文", status: "编辑中", createdAt: topic.createdAt, updatedAt: topic.createdAt }));

test("当天过了中午仍安排当天空闲工作日，不跳到明天", () => {
  const next = planAutomaticSchedule(items, topics, new Date(2026, 8, 16, 23, 59));
  assert.equal(next.contentItems[0].scheduledAt, new Date(2026, 8, 16, 12).toISOString());
});

test("新增不同题材选题插入已有自动档期，工作日无撞期且原始数据不变", () => {
  const first = planAutomaticSchedule(items, topics, from);
  const newTopic: Topic = { ...topics[0], id: "new", title: "图片工具实操", section: "工具与工作流", createdAt: "2026-09-14T00:00:00Z" };
  const next = planAutomaticSchedule(first.contentItems, [...topics, newTopic], from);
  const date = next.topics.find(topic => topic.id === "new")!.suggestedScheduledAt!;
  assert.ok(date < next.contentItems.at(-1)!.scheduledAt!);
  const dates = [...next.contentItems.map(item => item.scheduledAt!), date];
  assert.equal(new Set(dates).size, 4);
  assert.ok(dates.every(date => ![0, 6].includes(new Date(date).getDay())));
  assert.equal(items[0].scheduledAt, undefined);
});

test("保留已发布、历史排期和手动锁定；不同平台单独占位", () => {
  const locked = { ...items[0], scheduledAt: new Date(2026, 8, 14, 12).toISOString(), scheduleMode: "manual" as const };
  const published = { ...items[1], status: "公众号已发布" as const, scheduledAt: "2026-09-10T03:00:00Z", scheduleMode: "auto" as const };
  const legacy = { ...items[2], scheduledAt: new Date(2026, 8, 15, 12).toISOString() };
  const social = { ...items[2], id: "social", platform: "xiaohongshu" as const };
  const next = planAutomaticSchedule([locked, published, legacy, social], topics, from);
  assert.deepEqual(next.contentItems.slice(0, 3), [locked, published, legacy]);
  assert.equal(next.contentItems[3].scheduledAt, locked.scheduledAt);
});
