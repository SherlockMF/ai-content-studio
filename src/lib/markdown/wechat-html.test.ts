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
    /<strong[^>]*>\s*<span[^>]*font-weight:\s*bold[^>]*>重点结论<\/span>\s*<\/strong>/i
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
