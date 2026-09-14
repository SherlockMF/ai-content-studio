import assert from "node:assert/strict";
import test from "node:test";
import { SYSTEM_PROMPT } from "./prompts";
import { buildDeAiRewriteSystemPrompt } from "./skills";
import { IMAGE_GPT_PROMPT_RULES } from "@/lib/illustrations/prompt-style";
import { COVER_GPT_PROMPT_RULES } from "@/lib/illustrations/cover-prompt-style";
import { buildXiaohongshuOutlinePrompt } from "./xiaohongshu-prompt";
import { buildSupplementaryNotesPrompt } from "@/lib/content-supplementary-notes";

test("publishing rules reach generation, rewrite, outline extraction and image planning", () => {
  for (const prompt of [SYSTEM_PROMPT, buildDeAiRewriteSystemPrompt(), IMAGE_GPT_PROMPT_RULES,
    COVER_GPT_PROMPT_RULES, buildXiaohongshuOutlinePrompt({ title: "中层", body: "课件第59页。发布前请核验来源。" })]) {
    assert.match(prompt, /发布内容与内部资料隔离/);
    assert.match(prompt, /页码不是业务事实/);
    assert.match(prompt, /正常讨论课程或培训/);
    assert.match(prompt, /不得改成.*研究表明/);
  }
});

test("supplementary facts remain available without requiring internal course notes in the article", () => {
  const prompt = buildSupplementaryNotesPrompt("产品A测得91分；课程锚点：课件第59页；发布前核验来源。");
  assert.ok(!prompt.includes("改稿时必须融入正文"));
  assert.match(prompt, /仅融入适合公开的业务事实/);
  assert.match(prompt, /来源标记和编辑提醒仅供内部参考/);
  assert.match(prompt, /产品A测得91分/);
});
