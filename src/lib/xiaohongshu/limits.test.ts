import assert from "node:assert/strict";
import test from "node:test";
import {
  XIAOHONGSHU_BODY_MAX_CHARS,
  XIAOHONGSHU_TITLE_MAX_CHARS,
  clampXiaohongshuBody,
  clampXiaohongshuTitle,
  countXiaohongshuChars,
} from "./limits";

test("counts unicode code points", () => {
  assert.equal(countXiaohongshuChars("标题二十"), 4);
  assert.equal(countXiaohongshuChars("a🚀b"), 3);
});

test("clamps title and body to platform limits", () => {
  const longTitle = "一二三四五六七八九十一二三四五六七八九十超";
  assert.equal(countXiaohongshuChars(longTitle), 21);
  assert.equal(
    countXiaohongshuChars(clampXiaohongshuTitle(longTitle)),
    XIAOHONGSHU_TITLE_MAX_CHARS
  );

  const longBody = "字".repeat(XIAOHONGSHU_BODY_MAX_CHARS + 50);
  assert.equal(
    countXiaohongshuChars(clampXiaohongshuBody(longBody)),
    XIAOHONGSHU_BODY_MAX_CHARS
  );
});
