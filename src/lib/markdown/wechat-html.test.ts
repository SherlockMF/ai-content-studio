import assert from "node:assert/strict";
import test from "node:test";
import { buildWechatDocxBlob, renderWechatDocxFromMarkdown } from "./wechat-docx";
import { renderWechatHtml } from "./wechat-html";
import { WECHAT_THEME_TECH_EVAL } from "./wechat-theme";

test("strong theme uses WeChat-safe bold (bold keyword + black, no !important)", () => {
  assert.match(WECHAT_THEME_TECH_EVAL.strong, /font-weight:\s*bold/i);
  assert.match(WECHAT_THEME_TECH_EVAL.strong, /color:\s*#000000/i);
  assert.doesNotMatch(WECHAT_THEME_TECH_EVAL.strong, /!important/);
});

test("new themes number H2 only and reset numbering for each render", async () => {
  const markdown = "## 起步\n\n正文 **重点结论**。\n\n### 细节\n\n## 验证";
  for (const theme of ["tech-minimal", "tutorial-cards", "editorial"] as const) {
    const html = await renderWechatHtml(markdown, { theme, numberSections: true });
    assert.match(html, />01<\/span>/);
    assert.match(html, />02<\/span>/);
    assert.doesNotMatch(html, />03<\/span>/);
    assert.equal(await renderWechatHtml(markdown, { theme, numberSections: true }), html);
    const plain = await renderWechatHtml(markdown, { theme, numberSections: false });
    assert.doesNotMatch(plain, />01<\/span>/);
    assert.match(plain, /起步/);
  }
});

test("emphasis can be disabled without removing original bold text", async () => {
  const withAccent = await renderWechatHtml("正文 **重点**。", { theme: "tech-minimal", emphasize: true });
  const withoutAccent = await renderWechatHtml("正文 **重点**。", { theme: "tech-minimal", emphasize: false });
  assert.notEqual(withAccent, withoutAccent);
  assert.match(withoutAccent, /<strong/);
  assert.match(withoutAccent, /重点/);
});

test("standalone images have captions, missing alt does not create a caption", async () => {
  const html = await renderWechatHtml("![测试图](/article-assets/a.png)", { theme: "editorial", embedImages: false });
  assert.match(html, /<img[^>]+alt="测试图"/);
  assert.match(html, /<span leaf="">测试图<\/span>/);
  assert.doesNotMatch(html, /<p[^>]*>\s*<p/);
  const noCaption = await renderWechatHtml("![](/article-assets/a.png)", { theme: "editorial", embedImages: false });
  assert.doesNotMatch(noCaption, /<span leaf=""><\/span>/);
});

test("raw HTML cannot execute in preview and code text remains unchanged", async () => {
  const html = await renderWechatHtml('<img src=x onerror="alert(1)">\n\n<script>alert(2)</script>\n\n`x < 2`');
  assert.doesNotMatch(html, /<script|<img/i);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /x &lt; 2/);
});

test("unsafe links and image resolver results are rejected before HTML is displayed", async () => {
  await assert.rejects(renderWechatHtml("[链接](javascript:alert%281%29)"), /链接|协议/);
  await assert.rejects(renderWechatHtml("![图](/article-assets/a.png)", {
    imageResolver: async () => "data:image/svg+xml;base64,PHN2Zz4=",
  }), /图片|协议/);
});

test("copy/export cannot silently drop an image that could not be embedded", async () => {
  await assert.rejects(renderWechatHtml("![外部图片](https://example.com/a.png)", { embedImages: true }), /图片/);
});

test("unfinished image placeholders remain visible in preview but block export", async () => {
  const body = "## 正文\n\n![示意图](待替换-公众号配图-1)\n\n继续阅读。";
  const preview = await renderWechatHtml(body, { theme: "editorial", embedImages: false });
  assert.match(preview, /待配图：示意图/);
  assert.match(preview, /继续阅读/);
  await assert.rejects(renderWechatHtml(body, { embedImages: true }), /图片|配图/);
});

test("list item reference definitions are metadata and block children retain their content", async () => {
  const body = "- 内容\n\n  > 引用文字\n\n  [doc]: https://example.com\n\n  [参考][doc]";
  const html = await renderWechatHtml(body);
  assert.match(html, /引用文字/);
  assert.match(html, /href="https:\/\/example.com"/);
});

test("reference links and images resolve definitions after their use", async () => {
  const html = await renderWechatHtml("[文档][doc]\n\n![图注][pic]\n\n[doc]: https://example.com/docs\n[pic]: /article-assets/a.png", {
    theme: "editorial", embedImages: false,
  });
  assert.match(html, /href="https:\/\/example.com\/docs"/);
  assert.match(html, /src="\/article-assets\/a.png"/);
});

test("duplicate reference definitions consistently use the first definition", async () => {
  const html = await renderWechatHtml("[前面的链接][doc]\n\n[doc]: https://first.example\n\n[后面的链接][doc]\n\n[doc]: https://second.example");
  assert.equal([...html.matchAll(/href="https:\/\/first.example"/g)].length, 2);
  assert.doesNotMatch(html, /second.example/);
});

test("heading theme stays black and bold for WeChat paste", () => {
  assert.match(WECHAT_THEME_TECH_EVAL.h2, /font-weight:\s*bold/i);
  assert.match(WECHAT_THEME_TECH_EVAL.h2, /color:\s*#000000/i);
  assert.match(WECHAT_THEME_TECH_EVAL.h3, /font-weight:\s*bold/i);
});

test("HTML keeps H1 formula as bold paragraph instead of dropping it", async () => {
  const html = await renderWechatHtml(
    `前言\n\n# **Agent = Model + Harness**\n\n后记\n\n这是 **加粗**。`,
    { stripH1: true, embedImages: false }
  );
  assert.match(html, /Agent = Model \+ Harness/);
  assert.match(html, /加粗/);
  assert.match(html, /<strong/);
  assert.match(html, /font-weight:\s*bold/i);
});

test("HTML strong wraps span so WeChat keeps bold weight", async () => {
  const html = await renderWechatHtml(`正文 **重点结论** 结束`, {
    embedImages: false,
  });
  assert.match(
    html,
    /<strong[^>]*>\s*<span[^>]*font-weight:\s*bold[^>]*><span leaf="">重点结论<\/span><\/span>\s*<\/strong>/i
  );
});

test("DOCX headings do not use Word Heading styles (avoid WeChat blue)", async () => {
  const children = await renderWechatDocxFromMarkdown(
    `## Harness到底是什么？\n\n段落 **加粗** 文字。`,
    { stripH1: true }
  );
  const blob = await buildWechatDocxBlob(children);
  const buf = Buffer.from(await blob.arrayBuffer());
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml")!.async("string");
  assert.doesNotMatch(xml, /w:val="Heading[1-9]"/);
  assert.match(xml, /Harness到底是什么？/);
  assert.match(xml, /w:b[\s/]/);
});

test("DOCX keeps GPT image prompts from HTML comments", async () => {
  const children = await renderWechatDocxFromMarkdown(
    `![概念图](待替换-上传图片后填链接)\n\n<!-- GPT 配图提示词（简体中文，复制到 ChatGPT 生图）\n中央大公式 Agent = Model + Harness，标注上限与兑现率。\n-->`,
    { stripH1: true }
  );
  const blob = await buildWechatDocxBlob(children);
  const buf = Buffer.from(await blob.arrayBuffer());
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml")!.async("string");
  assert.match(xml, /配图占位/);
  assert.match(xml, /概念图/);
  assert.match(xml, /GPT 配图提示词/);
  assert.match(xml, /Agent = Model \+ Harness/);
});
