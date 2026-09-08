import assert from "node:assert/strict";
import test from "node:test";
import { extractWechatImages, validateWechatMediaPlan, renderWechatMedia } from "./wechat-media";

const images = [
  { sourceIndex: 0, action: "keep" as const, purpose: "cover" as const, altText: "公众号封面", anchorSnippet: "", prompt: "原封面", sourceUrl: "/article-assets/cover.png" },
  ...[1, 2, 3].map((i) => ({ sourceIndex: i, action: "generate" as const, purpose: "illustration" as const, altText: `配图${i}`, anchorSnippet: `第${i}段。`, prompt: `新图${i}`, sourceUrl: `/article-assets/old${i}.png` })),
];

test("extracts image prompts and keeps prose while removing image blocks", () => {
  const result = extractWechatImages("![公众号封面](/article-assets/a.png)\n\n<!-- 公众号封面 GPT 提示词\n原提示词\n-->\n\n段落。");
  assert.equal(result.images[0].prompt, "原提示词");
  assert.equal(result.images[0].purpose, "cover");
  assert.equal(result.body.trim(), "段落。");
});

test("media plan rejects keeping missing images and dropping existing ones", () => {
  const existing = extractWechatImages("![公众号封面](待替换-上传封面图后填链接)").images;
  assert.throws(() => validateWechatMediaPlan(images, existing, "第1段。\n第2段。\n第3段。"), /保留|索引/);
  const real = extractWechatImages("![公众号封面](/article-assets/a.png)").images;
  assert.throws(() => validateWechatMediaPlan(images.map((i) => ({ ...i, sourceIndex: null, action: "generate" })), real, "第1段。\n第2段。\n第3段。"), /遗漏/);
});

test("generates only mismatched pictures, saves each result, and leaves failed slots retryable", async () => {
  const called: string[] = [];
  const saved: string[] = [];
  const result = await renderWechatMedia({ body: "第1段。\n\n第2段。\n\n第3段。", images }, {
    generate: async ({ prompt }) => {
      called.push(prompt);
      if (prompt === "新图2") throw new Error("额度不足");
      return { url: `/article-assets/${prompt}.png` };
    },
    onUpdate: (body) => { saved.push(body); },
  });
  assert.deepEqual(called, ["新图1", "新图2", "新图3"]);
  assert.ok(result.body.includes("/article-assets/cover.png"));
  assert.ok(result.body.includes("/article-assets/新图1.png"));
  assert.ok(result.body.includes("待替换-公众号配图-3"));
  assert.equal(result.failures.length, 1);
  assert.equal(saved.length, 3);
  assert.ok(result.body.indexOf("第1段。") < result.body.indexOf("/article-assets/新图1.png"));
});

test("first generation renders cover and three illustrations", async () => {
  const purposes: string[] = [];
  await renderWechatMedia({ body: "第1段。\n第2段。\n第3段。", images: images.map((image) => ({ ...image, action: "generate" })) }, {
    generate: async ({ purpose }) => { purposes.push(purpose); return { url: `/article-assets/${purposes.length}.png` }; },
    onUpdate: () => {},
  });
  assert.deepEqual(purposes, ["cover", "illustration", "illustration", "illustration"]);
});
