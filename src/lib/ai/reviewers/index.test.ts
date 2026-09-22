import assert from "node:assert/strict";
import test from "node:test";
import { reviewContent } from "./index";
import type { LLMMessage, LLMProvider } from "@/lib/ai/providers/types";

test("wechat review receives the Word delivery contract without claiming image verification", async () => {
  let messages: LLMMessage[] = [];
  const provider: LLMProvider = {
    async generateStructuredOutput<T>(input: LLMMessage[]) {
      messages = input;
      return { score: 90, issues: [] } as T;
    },
    async generateText() { throw new Error("unexpected text generation"); },
  };
  const body = "![已生成图片](/article-assets/real.png)\n\n![未完成图片](待替换-公众号配图-1)\n\nTODO：补充结尾";
  await reviewContent({ title: "测试稿", body, targetAudience: "职场人" }, provider);
  const instructions = messages.filter(message => message.role === "system").map(message => message.content).join("\n");
  assert.match(instructions, /Word.*嵌入/);
  assert.match(instructions, /\/article-assets\//);
  assert.match(instructions, /不能仅凭.*路径/);
  assert.match(instructions, /未验证/);
  assert.match(instructions, /待替换/);
  assert.match(instructions, /high.*证据/);
  assert.ok(messages.some(message => message.role === "user" && message.content.includes(body)));
});

test("质检提示词要求专名可读与引用呈现，并合并悬空来源旗标", async () => {
  let messages: LLMMessage[] = [];
  const provider: LLMProvider = {
    async generateStructuredOutput<T>(input: LLMMessage[]) {
      messages = input;
      return {
        score: 85,
        issues: [{ dimension: "结构可读", severity: "low", suggestion: "略" }],
      } as T;
    },
    async generateText() { throw new Error("unexpected text generation"); },
  };
  const body = "Stripe 介绍结果计费。\n\n[来源](https://stripe.com/x)\n\n下一段。";
  const result = await reviewContent({ title: "收费", body, targetAudience: "职场人" }, provider);
  const user = messages.find((m) => m.role === "user")?.content ?? "";
  assert.match(user, /专名可读/);
  assert.match(user, /引用呈现/);
  assert.ok(result.issues.some((i) => i.dimension === "orphan-source-link"));
  assert.ok(result.issues.some((i) => i.dimension === "结构可读"));
});
