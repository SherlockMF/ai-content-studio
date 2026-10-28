import assert from "node:assert/strict";
import test from "node:test";
import { validResult } from "@/lib/xiaohongshu/test-fixtures";
import { xiaohongshuOutlineSchema } from "@/lib/ai/schemas";
import { XIAOHONGSHU_FIXED_VISUAL_DIRECTION } from "@/lib/xiaohongshu/visual-rules";
import {
  buildXiaohongshuConversionPrompt,
  buildXiaohongshuOutlinePrompt,
  buildXiaohongshuReviewPrompt,
} from "./xiaohongshu-prompt";

const sampleOutline = {
  subjects: ["Parvis", "Codex", "Cola", "WorkBuddy"],
  keyFacts: ["25 项任务", "绿化率 GIS 为 33.88%"],
  roundConclusions: ["专项任务 Parvis 较强", "开放任务自主编排不稳"],
  overallJudgment: "专项强但自主弱，适合作为工具平台",
  optionalDetails: ["九阶段任务树细节"],
};

test("outline schema requires subjects and key facts", () => {
  assert.equal(xiaohongshuOutlineSchema.safeParse(sampleOutline).success, true);
  assert.equal(
    xiaohongshuOutlineSchema.safeParse({
      ...sampleOutline,
      subjects: [],
    }).success,
    false
  );
});

test("outline prompt asks for subjects key facts and optional details", () => {
  const prompt = buildXiaohongshuOutlinePrompt({
    title: "盲测 4 款城市规划 AI",
    digest: "专项强但自主弱",
    body: "同一套资料测了 Parvis、Codex、Cola、WorkBuddy。共 25 项任务。",
    cta: "你怎么看？",
    supplementaryNotes: "数字不得改变。",
  });
  assert.match(prompt, /subjects/);
  assert.match(prompt, /keyFacts/);
  assert.match(prompt, /roundConclusions/);
  assert.match(prompt, /overallJudgment/);
  assert.match(prompt, /optionalDetails/);
  assert.match(prompt, /Parvis、Codex、Cola、WorkBuddy/);
  assert.match(prompt, /对比主体/);
});

test("conversion prompt preserves facts and requests both tones with outline coverage", () => {
  const prompt = buildXiaohongshuConversionPrompt({
    title: "公众号标题",
    digest: "摘要",
    body: "原文明确包含 25 项任务。测了 Parvis、Codex、Cola、WorkBuddy。",
    cta: "欢迎讨论",
    supplementaryNotes: "数字不得改变。",
    outline: sampleOutline,
  });
  assert.match(prompt, /唯一事实基线/);
  assert.match(prompt, /禁止虚构/);
  assert.match(prompt, /professional/);
  assert.match(prompt, /social/);
  assert.match(prompt, /5～8/);
  assert.match(prompt, /25 项任务/);
  assert.match(prompt, /禁止站外引流、求赞求关注或私信引导/);
  assert.match(prompt, /不超过 20 字/);
  assert.match(prompt, /不超过 1000 字/);
  assert.match(prompt, /#话题/);
  assert.match(prompt, /正文一体/);
  assert.match(prompt, /独立结论/);
  assert.match(prompt, /Parvis/);
  assert.match(prompt, /WorkBuddy/);
  assert.match(prompt, /optionalDetails/);
  assert.match(prompt, /图文笔记/);
  assert.match(prompt, /Everything is a Plugin|科幻概念海报/);
  assert.match(prompt, /emoji/);
  assert.match(prompt, /讲解页/);
  assert.match(prompt, /暖米白|暖色/);
  assert.match(prompt, /冷蓝紫科技感|非冷色科技风/);
  assert.ok(prompt.includes(XIAOHONGSHU_FIXED_VISUAL_DIRECTION));
  assert.match(prompt, /整组图片统一不显示页码和角标/);
});

test("Xiaohongshu review prompt covers source facts subject coverage and image continuity", () => {
  const prompt = buildXiaohongshuReviewPrompt({
    sourceBody: "原文数字为 25 项任务。测了 Parvis、Codex、Cola、WorkBuddy。",
    title: "改编标题",
    body: "改编正文",
    cta: "你怎么看？",
    hashtags: ["AI工作流", "组织进化", "职场成长", "效率工具", "知识管理"],
    visualDirection: "米白知识卡片",
    imagePlan: validResult.imagePlan,
    targetAudience: "企业管理者",
  });
  assert.match(prompt, /事实一致性/);
  assert.match(prompt, /虚构个人经历/);
  assert.match(prompt, /主体覆盖/);
  assert.match(prompt, /图片规划/);
  assert.match(prompt, /暖色|冷蓝紫|固定暖色/);
  assert.match(prompt, /20 字/);
  assert.match(prompt, /1000 字/);
  assert.match(prompt, /25 项任务/);
});
