import assert from "node:assert/strict";
import test from "node:test";
import type { XiaohongshuDraftData } from "@/types/domain";
import { validResult } from "./test-fixtures";
import {
  buildXiaohongshuNoteText,
  buildXiaohongshuPublishChecks,
  buildXiaohongshuPublishMarkdown,
} from "./publish";

const draftData: XiaohongshuDraftData = {
  sourceContentId: "wechat-1",
  activeTone: "professional",
  ...validResult,
};
const variant = draftData.variants.professional;

test("builds a complete note as title plus body with inline hashtags", () => {
  assert.equal(
    buildXiaohongshuNoteText(variant),
    "专业版标题\n\n专业版正文\n\n你会怎么做？\n\n#AI工作流 #组织进化 #职场成长 #效率工具 #知识管理"
  );
});

test("blocks publish when body lacks enough #hashtags", () => {
  const checks = buildXiaohongshuPublishChecks({
    data: {
      ...draftData,
      variants: {
        ...draftData.variants,
        professional: {
          ...variant,
          body: "只有正文没有话题",
          hashtags: [],
        },
      },
    },
    tone: "professional",
    review: undefined,
  });
  assert.equal(checks.find((item) => item.id === "hashtags")?.ok, false);
});

test("blocks publish when title or body exceeds platform limits", () => {
  const overTitle = buildXiaohongshuPublishChecks({
    data: {
      ...draftData,
      variants: {
        ...draftData.variants,
        professional: {
          ...variant,
          title: "一二三四五六七八九十一二三四五六七八九十超",
        },
      },
    },
    tone: "professional",
    review: undefined,
  });
  assert.equal(overTitle.find((item) => item.id === "title")?.ok, false);

  const overBody = buildXiaohongshuPublishChecks({
    data: {
      ...draftData,
      variants: {
        ...draftData.variants,
        professional: {
          ...variant,
          body: "字".repeat(1001),
        },
      },
    },
    tone: "professional",
    review: undefined,
  });
  assert.equal(overBody.find((item) => item.id === "body")?.ok, false);
});

test("exports both tones and every numbered prompt", () => {
  const markdown = buildXiaohongshuPublishMarkdown(
    draftData,
    "professional",
    "公众号标题"
  );
  assert.match(markdown, /## 当前发布版本：专业轻表达/);
  assert.match(markdown, /## 备选版本：强氛围版/);
  assert.match(markdown, /来源稿件：公众号标题/);
  assert.match(markdown, new RegExp(validResult.visualDirection));
  assert.match(markdown, new RegExp(validResult.variants.professional.body));
  assert.match(markdown, new RegExp(validResult.variants.social.body));
  assert.match(markdown, /### 图 1 · 封面/);
  assert.match(markdown, /### 图 5 · 收尾/);

  for (const image of validResult.imagePlan) {
    assert.match(markdown, new RegExp(image.objective));
    assert.match(markdown, new RegExp(image.overlayText));
    assert.match(markdown, new RegExp(image.composition));
    assert.match(markdown, new RegExp(image.prompt));
  }
});
