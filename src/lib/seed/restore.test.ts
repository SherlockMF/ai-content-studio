import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_CONTENT_ITEMS } from "@/lib/mock-data";
import type { ContentItem, ContentVersion } from "@/types/domain";
import { validResult } from "@/lib/xiaohongshu/test-fixtures";
import {
  maybeRestoreSeedContent,
  restoreOrphanedXiaohongshuFromVersions,
} from "./restore";

const wechatSeed = DEMO_CONTENT_ITEMS.find((item) => item.id === "content_gis")!;

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
