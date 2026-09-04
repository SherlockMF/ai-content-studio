import assert from "node:assert/strict";
import test from "node:test";
import { WECHAT_THEME_GENERAL, WECHAT_THEME_TECH_EVAL } from "./wechat-theme";

test("wechat paragraph styles leave a blank line between paragraphs without first-line indent", () => {
  assert.match(WECHAT_THEME_TECH_EVAL.p, /margin:\s*0\s+0\s+1\.75em/);
  assert.doesNotMatch(WECHAT_THEME_TECH_EVAL.p, /text-indent/);
  assert.match(WECHAT_THEME_GENERAL.p, /margin:\s*0\s+0\s+1\.75em/);
  assert.doesNotMatch(WECHAT_THEME_GENERAL.p, /text-indent/);
});
