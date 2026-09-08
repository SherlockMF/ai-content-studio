import assert from "node:assert/strict";
import test from "node:test";
import {
  applyIllustrationSuggestionsToBody,
  countBodyIllustrationPlaceholders,
  prependCoverPlaceholder,
  upsertCoverPlaceholder,
} from "./enrich-article-media";

test("applyIllustrationSuggestionsToBody inserts after anchors", () => {
  const body = "开头段落。\n\n这里是数据对比：绿化率 33.88%。\n\n结尾。";
  const next = applyIllustrationSuggestionsToBody(body, [
    {
      id: "1",
      placementLabel: "数据段",
      anchorSnippet: "绿化率 33.88%。",
      reason: "数据可视化",
      imageKind: "数据图表",
      gptPrompt: "画一张绿化率对比图，标注 33.88%。",
      altText: "绿化率对比",
    },
  ]);
  assert.equal(next.inserted, 1);
  assert.match(next.body, /绿化率 33\.88%。/);
  assert.match(next.body, /!\[绿化率对比\]\(待替换-上传图片后填链接\)/);
  assert.match(next.body, /画一张绿化率对比图/);
  assert.equal(countBodyIllustrationPlaceholders(next.body), 1);
});

test("prependCoverPlaceholder adds cover block once", () => {
  const body = "正文开始";
  const withCover = prependCoverPlaceholder(body, {
    id: "c1",
    styleLabel: "概念",
    overlayText: "短句",
    gptPrompt: "封面提示词",
    altText:
      "插画显示四级台阶，从个人工具到组织重塑的演进，顶部标题强调会用ChatGPT不等于完成AI转型",
  });
  assert.match(withCover, /!\[公众号封面\]\(待替换-上传封面图后填链接\)/);
  assert.doesNotMatch(withCover, /!\[插画显示四级台阶/);
  assert.match(withCover, /封面提示词/);
  const again = prependCoverPlaceholder(withCover, {
    id: "c1",
    styleLabel: "概念",
    overlayText: "短句",
    gptPrompt: "封面提示词2",
    altText: "封面",
  });
  assert.equal((again.match(/待替换-上传封面图后填链接/g) ?? []).length, 1);
});

test("upsertCoverPlaceholder replaces leading cover block", () => {
  const first = upsertCoverPlaceholder("正文开始", {
    id: "c1",
    styleLabel: "概念",
    overlayText: "短句",
    gptPrompt: "封面提示词A",
    altText: "封面",
  });
  const second = upsertCoverPlaceholder(first, {
    id: "c2",
    styleLabel: "概念",
    overlayText: "短句",
    gptPrompt: "封面提示词B",
    altText: "封面",
  });
  assert.match(second, /封面提示词B/);
  assert.doesNotMatch(second, /封面提示词A/);
  assert.equal((second.match(/待替换-上传封面图后填链接/g) ?? []).length, 1);
  assert.match(second, /正文开始/);
});
