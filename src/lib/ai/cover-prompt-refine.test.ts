import assert from "node:assert/strict";
import test from "node:test";
import { coverPromptRefineOutputSchema } from "@/lib/ai/schemas";
import { buildCoverPromptRefinePrompt } from "@/lib/ai/cover-prompt-refine";

test("refine output schema requires gptPrompt", () => {
  assert.equal(
    coverPromptRefineOutputSchema.safeParse({
      gptPrompt: "优化后的提示词",
      overlayText: "新短文案",
    }).success,
    true
  );
  assert.equal(coverPromptRefineOutputSchema.safeParse({ gptPrompt: "" }).success, false);
  assert.equal(coverPromptRefineOutputSchema.safeParse({}).success, false);
});

test("refine prompt includes original prompt and user suggestion", () => {
  const prompt = buildCoverPromptRefinePrompt({
    title: "Agent = Model + Harness",
    styleLabel: "概念插画封面",
    overlayText: "Agent = Model + Harness",
    gptPrompt: "原始提示词内容",
    suggestion: "把大脑图标改成电路板，背景换成深蓝",
  });
  assert.match(prompt, /根据用户修改建议/);
  assert.match(prompt, /原始提示词内容/);
  assert.match(prompt, /把大脑图标改成电路板/);
  assert.match(prompt, /2\.35:1/);
  assert.match(prompt, /概念插画封面/);
});
