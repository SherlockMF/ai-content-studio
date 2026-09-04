import assert from "node:assert/strict";
import test from "node:test";
import {
  extractHashtagsFromText,
  foldXiaohongshuVariant,
  formatHashtagLine,
} from "./note-body";

test("formatHashtagLine adds # and strips duplicates prefixes", () => {
  assert.equal(
    formatHashtagLine(["#AI", "效率工具", "##知识管理"]),
    "#AI #效率工具 #知识管理"
  );
});

test("extractHashtagsFromText reads inline tags", () => {
  assert.deepEqual(
    extractHashtagsFromText("正文\n\n#AI工作流 #组织进化 #职场成长"),
    ["AI工作流", "组织进化", "职场成长"]
  );
});

test("foldXiaohongshuVariant merges cta and hashtags into body with #", () => {
  const folded = foldXiaohongshuVariant({
    title: "短标题",
    body: "核心观点写这里",
    cta: "你怎么看？",
    hashtags: ["AI工作流", "组织进化", "职场成长", "效率工具", "知识管理"],
  });
  assert.equal(folded.cta, "");
  assert.match(folded.body, /核心观点写这里/);
  assert.match(folded.body, /你怎么看？/);
  assert.match(folded.body, /#AI工作流 #组织进化 #职场成长 #效率工具 #知识管理/);
  assert.deepEqual(folded.hashtags, [
    "AI工作流",
    "组织进化",
    "职场成长",
    "效率工具",
    "知识管理",
  ]);
});

test("foldXiaohongshuVariant does not duplicate tags already in body", () => {
  const folded = foldXiaohongshuVariant({
    title: "短标题",
    body: "正文\n\n#A #B #C #D #E",
    cta: "",
    hashtags: ["A", "B", "C", "D", "E"],
  });
  assert.equal((folded.body.match(/#A/g) ?? []).length, 1);
});
