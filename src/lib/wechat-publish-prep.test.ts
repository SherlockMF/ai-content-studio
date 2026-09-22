import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatMediaStepToast,
  hasWechatBodyImages,
  shouldSkipDeAi,
} from "./wechat-publish-prep";

describe("shouldSkipDeAi", () => {
  it("skips when source is ai (from_scratch already ran deAiRewrite)", () => {
    assert.equal(shouldSkipDeAi({ source: "ai", polishedAt: undefined }), true);
  });

  it("skips when already polished via ai_rewrite", () => {
    assert.equal(
      shouldSkipDeAi({ source: "imported", polishedAt: "2026-09-22T01:00:00Z" }),
      true
    );
  });

  it("runs de-ai for imported draft without polish record", () => {
    assert.equal(shouldSkipDeAi({ source: "imported", polishedAt: undefined }), false);
  });
});

describe("hasWechatBodyImages / formatMediaStepToast", () => {
  it("treats body without markdown images as 无图", () => {
    assert.equal(hasWechatBodyImages("只有文字，没有图片。"), false);
    assert.equal(formatMediaStepToast({ hasImages: false, failures: [] }), "补图：无图");
  });

  it("keeps normal success toast when body has images and no failures", () => {
    assert.equal(hasWechatBodyImages("![封面](/article-assets/a.png)\n\n段落。"), true);
    assert.equal(
      formatMediaStepToast({ hasImages: true, failures: [] }),
      "配图已检查并保存，匹配的原图已保留"
    );
  });

  it("reports failures without claiming 无图", () => {
    assert.equal(
      formatMediaStepToast({ hasImages: true, failures: ["图 1：超时"] }),
      "文案已保存，1 张配图未完成：图 1：超时"
    );
  });
});
