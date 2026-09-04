import assert from "node:assert/strict";
import test from "node:test";
import {
  buildXiaohongshuRenderPrompt,
  isBlindtestXiaohongshuPlan,
} from "./generate-images";

test("blindtest plan detection and icon prompt injection", () => {
  const plan = [
    {
      index: 1,
      role: "cover" as const,
      objective: "对比",
      overlayText: "Parvis 盲测对比",
      composition: "五列卡片",
      prompt: "暖色讲解页，展示 Parvis Codex Cola WorkBuddy",
    },
  ];
  assert.equal(isBlindtestXiaohongshuPlan(plan), true);
  const prompt = buildXiaohongshuRenderPrompt(plan[0], "暖色固定视觉");
  assert.match(prompt, /晶透立体字母/);
  assert.match(prompt, /橙色圆环/);
  assert.match(prompt, /猫\/机器人/);
  assert.match(prompt, /严禁/);
  assert.match(prompt, /文具静物|notebook|mockup|禁止用乱码/);
});
