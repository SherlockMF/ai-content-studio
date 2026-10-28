import test from "node:test";
import assert from "node:assert/strict";
import { buildWechatPublishChecks, buildWechatPublishHtml, buildWechatHtmlDocument } from "./wechat-publish";

test("公众号正文误用小红书配图时标出具体位置", () => {
  const checks = buildWechatPublishChecks({
    title: "商品图", body: "![封面](/article-assets/cover.png)\n![字段](/article-assets/xhs.png)",
    xiaohongshuImageUrls: ["/article-assets/xhs.png"],
  });
  const check = checks.find(item => item.id === "image-platform");
  assert.equal(check?.ok, false);
  assert.match(check?.hint ?? "", /第 2 张/);
});

test("HTML download and preview share the same theme rendering and escape document title", async () => {
  const input = { title: '</title><script>x()</script>', body: '## 章节\n\n正文 **重点**', theme: 'editorial' as const, numberSections: true, emphasize: false };
  const preview = await buildWechatPublishHtml({ ...input, embedImages: false });
  const document = await buildWechatHtmlDocument(input);
  assert.ok(document.includes(preview));
  assert.match(document, /charset="utf-8"/);
  assert.doesNotMatch(document, /<script>/);
  assert.match(document, /&lt;script&gt;/);
});

test("独立的公众号配图不因同选题小红书存在而被拦截", () => {
  const checks = buildWechatPublishChecks({
    title: "商品图", body: "![字段](/article-assets/wechat.png)",
    xiaohongshuImageUrls: ["/article-assets/xhs.png"],
  });
  assert.equal(checks.find(item => item.id === "image-platform")?.ok, true);
});

test("悬空来源与损坏表格在发布检查中失败", () => {
  const checks = buildWechatPublishChecks({
    title: "收费",
    body: "说明。\n\n[来源](https://stripe.com/x)\n\n| a | b | | --- | --- | | 1 | 2 |",
  });
  assert.equal(checks.find((c) => c.id === "orphan-source-link")?.ok, false);
  assert.equal(checks.find((c) => c.id === "broken-markdown-table")?.ok, false);
});

test("正常表格给出非阻断预览提醒", () => {
  const checks = buildWechatPublishChecks({
    title: "收费",
    body: "| a | b |\n| --- | --- |\n| 1 | 2 |",
  });
  const reminder = checks.find((c) => c.id === "table-preview-reminder");
  assert.equal(reminder?.ok, true);
  assert.match(reminder?.hint ?? "", /预览|成表|源码/);
});

test("公众号发布检查含贴图一文双发提醒", () => {
  const checks = buildWechatPublishChecks({
    title: "收费",
    body: "正文",
  });
  const sticker = checks.find((c) => c.id === "sticker-reminder");
  assert.equal(sticker?.ok, true);
  assert.match(sticker?.hint ?? "", /贴图|非粉/);
});
