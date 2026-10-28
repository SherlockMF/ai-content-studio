import assert from "node:assert/strict";
import test from "node:test";
import { getWechatTheme, WECHAT_THEMES, WECHAT_THEME_GENERAL, WECHAT_THEME_TECH_EVAL } from "./wechat-theme";

test("wechat paragraph styles leave a blank line between paragraphs without first-line indent", () => {
  assert.match(WECHAT_THEME_TECH_EVAL.p, /margin:\s*0\s+0\s+1\.75em/);
  assert.doesNotMatch(WECHAT_THEME_TECH_EVAL.p, /text-indent/);
  assert.match(WECHAT_THEME_GENERAL.p, /margin:\s*0\s+0\s+1\.75em/);
  assert.doesNotMatch(WECHAT_THEME_GENERAL.p, /text-indent/);
});

test("three editorial themes extend the existing themes with distinct component styles", () => {
  assert.equal(WECHAT_THEMES.length, 5);
  for (const id of ["tech-minimal", "tutorial-cards", "editorial"] as const) {
    const theme = getWechatTheme(id);
    assert.equal(theme.id, id);
    assert.ok(theme.chapter);
    assert.ok(theme.highlight);
    assert.ok(theme.caption);
  }
  assert.equal(new Set(WECHAT_THEMES.map(theme => theme.h2)).size, 5);
});
