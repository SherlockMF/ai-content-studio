import assert from "node:assert/strict";
import test from "node:test";
import {
  compareByWorkbenchOrder,
  normalizeContentStatus,
  statusSortRank,
} from "@/lib/content-status";
import { DEMO_CONTENT_ITEMS } from "@/lib/mock-data";
import type { ContentItem, ContentVersion } from "@/types/domain";
import { validResult } from "@/lib/xiaohongshu/test-fixtures";
import {
  maybeRestoreSeedContent,
  repairSeedPublishLifecycle,
  restoreOrphanedXiaohongshuFromVersions,
  syncBuiltinSeedArticles,
} from "./restore";

const wechatSeed = DEMO_CONTENT_ITEMS.find((item) => item.id === "content_gis")!;

test("normalizeContentStatus migrates legacy 已发布 to 已归档", () => {
  assert.equal(normalizeContentStatus("已发布"), "已归档");
  assert.equal(normalizeContentStatus("公众号已发布"), "公众号已发布");
});

test("archived status sorts after active work", () => {
  assert.ok(statusSortRank("编辑中") < statusSortRank("已归档"));
  assert.equal(
    compareByWorkbenchOrder(
      { status: "已归档", scheduledAt: "2026-08-28", updatedAt: "z" },
      { status: "编辑中", scheduledAt: "2026-08-01", updatedAt: "a" }
    ) > 0,
    true
  );
});

test("maybeRestoreSeedContent does not overwrite Xiaohongshu drafts with WeChat seeds", () => {
  const xhsDraft: ContentItem = {
    id: `xhs_${wechatSeed.id}`,
    workspaceId: wechatSeed.workspaceId,
    topicId: wechatSeed.topicId,
    platform: "xiaohongshu",
    source: "ai",
    title: "小红书标题",
    body: "短正文".repeat(20),
    status: "编辑中",
    createdAt: "2026-09-04T00:00:00.000Z",
    updatedAt: "2026-09-04T00:00:00.000Z",
    xiaohongshu: {
      sourceContentId: wechatSeed.id,
      activeTone: "professional",
      ...validResult,
    },
  };

  const next = maybeRestoreSeedContent(xhsDraft);
  assert.equal(next.id, xhsDraft.id);
  assert.equal(next.platform, "xiaohongshu");
  assert.ok(next.xiaohongshu);
  assert.equal(next.body, xhsDraft.body);
});

test("restoreOrphanedXiaohongshuFromVersions rebuilds missing xhs items from version history", () => {
  const version: ContentVersion = {
    id: "version_1",
    contentItemId: `xhs_${wechatSeed.id}`,
    versionNumber: 2,
    title: "已保存小红书标题",
    body: "已保存小红书正文",
    changeSource: "user_edit",
    createdAt: "2026-09-04T01:00:00.000Z",
    xiaohongshu: {
      sourceContentId: wechatSeed.id,
      activeTone: "professional",
      ...validResult,
      variants: {
        ...validResult.variants,
        professional: {
          ...validResult.variants.professional,
          title: "已保存小红书标题",
          body: "已保存小红书正文",
        },
      },
    },
  };

  const restored = restoreOrphanedXiaohongshuFromVersions({
    contentItems: [wechatSeed],
    versions: [version],
  });

  const xhs = restored.find((item) => item.platform === "xiaohongshu");
  assert.ok(xhs);
  assert.equal(xhs?.id, `xhs_${wechatSeed.id}`);
  assert.equal(xhs?.title, "已保存小红书标题");
  assert.equal(xhs?.body, "已保存小红书正文");
  assert.ok(xhs?.xiaohongshu);
});

test("syncBuiltinSeedArticles never overwrites user lifecycle status with seed defaults", () => {
  const userItem: ContentItem = {
    ...wechatSeed,
    status: "公众号已发布",
    publishedAt: "2026-09-01T00:00:00.000Z",
    scheduledAt: "2026-08-28T12:00:00.000Z",
    body: "用户改过的正文不会影响本断言的 status",
  };
  const synced = syncBuiltinSeedArticles({
    topics: [],
    contentItems: [userItem],
    versions: [],
  });
  const next = synced.contentItems.find((item) => item.id === wechatSeed.id);
  assert.equal(next?.status, "公众号已发布");
  assert.equal(next?.publishedAt, "2026-09-01T00:00:00.000Z");
  assert.equal(next?.scheduledAt, "2026-08-28T12:00:00.000Z");
});

test("repairSeedPublishLifecycle archives stuck seed 待发布 items once", () => {
  const stuck: ContentItem = { ...wechatSeed, status: "待发布", publishedAt: null };
  const repaired = repairSeedPublishLifecycle(stuck);
  assert.equal(repaired.status, "已归档");
  assert.ok(repaired.publishedAt);
});

test("syncBuiltinSeedArticles inserts org architecture series drafts when missing", () => {
  const synced = syncBuiltinSeedArticles({
    topics: [],
    contentItems: [],
    versions: [],
  });
  const orgContents = synced.contentItems
    .filter((item) => item.id.startsWith("content_org_"))
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  assert.equal(orgContents.length, 6);
  assert.ok(orgContents.every((item) => item.status === "编辑中"));
  assert.deepEqual(
    orgContents.map((item) => item.scheduledAt?.slice(0, 10)),
    ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-14"]
  );
  assert.equal(orgContents[0]?.id, "content_org_fullstack");
  assert.equal(orgContents[5]?.id, "content_org_transform");
});
