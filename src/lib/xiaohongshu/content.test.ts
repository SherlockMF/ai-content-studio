import assert from "node:assert/strict";
import test from "node:test";

import { xiaohongshuOutputSchema } from "@/lib/ai/schemas";
import { XIAOHONGSHU_FIXED_VISUAL_DIRECTION } from "@/lib/xiaohongshu/visual-rules";
import {
  createXiaohongshuContent,
  normalizeXiaohongshuContent,
  saveXiaohongshuVariant,
} from "./content";
import { now, sourceItem, validResult } from "./test-fixtures";

test("accepts a complete result and rejects invalid image order", () => {
  assert.equal(xiaohongshuOutputSchema.safeParse(validResult).success, true);
  const invalid = {
    ...validResult,
    imagePlan: validResult.imagePlan.map((item, index) =>
      index === 0 ? { ...item, role: "content" as const } : item
    ),
  };
  assert.equal(xiaohongshuOutputSchema.safeParse(invalid).success, false);
});

test("schema preserves trailing hashtags in oversized model output without a separate hashtags field", () => {
  const hashtags = ["AI工作流", "组织进化", "职场成长", "效率工具", "知识管理"];
  const tagLine = hashtags.map((tag) => `#${tag}`).join(" ");
  const result = xiaohongshuOutputSchema.parse({
    ...validResult,
    variants: {
      ...validResult.variants,
      professional: {
        title: "短标题",
        body: "内容🚀".repeat(400) + `\n\n${tagLine}`,
      },
    },
  });
  assert.ok(Array.from(result.variants.professional.body).length <= 1000);
  assert.ok(result.variants.professional.body.endsWith(tagLine));
  assert.deepEqual(result.variants.professional.hashtags, hashtags);
  assert.deepEqual(xiaohongshuOutputSchema.parse(result), result);
});

test("rejects Xiaohongshu results outside image and hashtag constraints", () => {
  const contentImage = validResult.imagePlan[1];
  const endingImage = validResult.imagePlan.at(-1)!;
  const invalidResults = [
    {
      name: "fewer than five images",
      value: {
        ...validResult,
        imagePlan: [
          validResult.imagePlan[0],
          validResult.imagePlan[1],
          validResult.imagePlan[2],
          { ...endingImage, index: 4 },
        ],
      },
    },
    {
      name: "more than eight images",
      value: {
        ...validResult,
        imagePlan: [
          validResult.imagePlan[0],
          ...Array.from({ length: 7 }, (_, index) => ({
            ...contentImage,
            index: index + 2,
          })),
          { ...endingImage, index: 9 },
        ],
      },
    },
    {
      name: "non-contiguous image indexes",
      value: {
        ...validResult,
        imagePlan: validResult.imagePlan.map((item, index) =>
          index === 2 ? { ...item, index: 4 } : item
        ),
      },
    },
    {
      name: "last image is not ending",
      value: {
        ...validResult,
        imagePlan: validResult.imagePlan.map((item, index) =>
          index === validResult.imagePlan.length - 1
            ? { ...item, role: "content" as const }
            : item
        ),
      },
    },
    {
      name: "fewer than five hashtags in body",
      value: {
        ...validResult,
        variants: {
          ...validResult.variants,
          professional: {
            ...validResult.variants.professional,
            body: "专业版正文\n\n你会怎么做？\n\n#AI工作流 #组织进化",
            hashtags: ["AI工作流", "组织进化"],
          },
        },
      },
    },
  ];

  for (const invalid of invalidResults) {
    assert.equal(
      xiaohongshuOutputSchema.safeParse(invalid.value).success,
      false,
      invalid.name
    );
  }
});

test("creates one linked Xiaohongshu content item with professional active", () => {
  const item = createXiaohongshuContent({ source: sourceItem, result: validResult, now });
  assert.equal(item.platform, "xiaohongshu");
  assert.equal(item.xiaohongshu?.sourceContentId, "wechat-1");
  assert.equal(item.xiaohongshu?.activeTone, "professional");
  assert.equal(item.xiaohongshu?.visualDirection, XIAOHONGSHU_FIXED_VISUAL_DIRECTION);
  assert.equal(item.title, "专业版标题");
  assert.equal(item.coverCopy, "AI 不是工具升级");
});

test("create and normalize force the fixed warm visual direction", () => {
  const created = createXiaohongshuContent({
    source: sourceItem,
    result: { ...validResult, visualDirection: "冷蓝紫科技海报" },
    now,
  });
  assert.equal(created.xiaohongshu?.visualDirection, XIAOHONGSHU_FIXED_VISUAL_DIRECTION);

  const legacy = {
    ...created,
    xiaohongshu: {
      ...created.xiaohongshu!,
      visualDirection: "旧的科技风方向",
    },
  };
  const normalized = normalizeXiaohongshuContent(legacy);
  assert.equal(normalized.xiaohongshu?.visualDirection, XIAOHONGSHU_FIXED_VISUAL_DIRECTION);
});

test("updating linked content preserves scheduling and lifecycle metadata", () => {
  const existing = {
    ...createXiaohongshuContent({ source: sourceItem, result: validResult, now }),
    id: "xhs-existing",
    createdAt: "2026-08-01T00:00:00.000Z",
    status: "待发布" as const,
    scheduledAt: "2026-09-10T02:00:00.000Z",
    publishedAt: "2026-09-01T02:00:00.000Z",
  };

  const updated = createXiaohongshuContent({
    source: sourceItem,
    result: validResult,
    now: "2026-09-04T01:00:00.000Z",
    existing,
  });

  assert.equal(updated.id, existing.id);
  assert.equal(updated.createdAt, existing.createdAt);
  assert.equal(updated.status, existing.status);
  assert.equal(updated.scheduledAt, existing.scheduledAt);
  assert.equal(updated.publishedAt, existing.publishedAt);
});

test("saving social tone synchronizes common fields without changing professional", () => {
  const initial = createXiaohongshuContent({ source: sourceItem, result: validResult, now });
  const next = saveXiaohongshuVariant(
    initial,
    "social",
    { ...validResult.variants.social, title: "修改后的氛围版" },
    now
  );
  assert.equal(next.title, "修改后的氛围版");
  assert.match(next.body, /氛围版正文/);
  assert.match(next.body, /#AI工作流/);
  assert.equal(next.xiaohongshu?.variants.professional.title, "专业版标题");
});

test("legacy Xiaohongshu content without platform data remains readable", () => {
  const legacy = { ...sourceItem, id: "xhs-old", platform: "xiaohongshu" as const };
  assert.equal(normalizeXiaohongshuContent(legacy), legacy);
});
