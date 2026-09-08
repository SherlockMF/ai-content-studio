import assert from "node:assert/strict";
import test from "node:test";
import type { ContentItem, Topic } from "@/types/domain";
import {
  activeWechatContents,
  archivedWechatContents,
  topicsWithoutWechatDraft,
} from "@/lib/workspace-lists";

const topic = (id: string): Topic => ({
  id,
  workspaceId: "ws",
  title: id,
  coreViewpoint: "v",
  targetAudience: "a",
  painPoint: "p",
  section: "AI 通识",
  platform: ["wechat"],
  contentGoal: "g",
  recommendedFormat: "f",
  openingHook: "h",
  scheduled: false,
  createdAt: "2026-09-01T00:00:00.000Z",
});

const content = (
  id: string,
  topicId: string,
  status: ContentItem["status"]
): ContentItem => ({
  id,
  workspaceId: "ws",
  topicId,
  platform: "wechat",
  source: "imported",
  title: id,
  body: "body",
  status,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
});

test("topicsWithoutWechatDraft keeps only topics without wechat drafts", () => {
  const topics = [topic("t1"), topic("t2"), topic("t3")];
  const items = [content("c1", "t1", "编辑中"), content("c2", "t2", "已归档")];
  const pool = topicsWithoutWechatDraft(topics, items);
  assert.deepEqual(
    pool.map((item) => item.id),
    ["t3"]
  );
});

test("active and archived wechat lists split by status", () => {
  const items = [
    content("c1", "t1", "编辑中"),
    content("c2", "t2", "已归档"),
    content("c3", "t3", "待发布"),
  ];
  assert.deepEqual(
    activeWechatContents(items).map((item) => item.id),
    ["c1", "c3"]
  );
  assert.deepEqual(
    archivedWechatContents(items).map((item) => item.id),
    ["c2"]
  );
});
