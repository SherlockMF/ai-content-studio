import assert from "node:assert/strict";
import test from "node:test";
import { handleReviewRevision } from "./handler";
import { reviseReviewedContent } from "@/lib/ai/review-revision";
import type { LLMProvider } from "@/lib/ai/providers/types";

const input = {
  draft: { platform: "wechat" as const, title: "旧标题", body: "原正文 42。", digest: "摘要" },
  issues: [{ dimension: "标题", severity: "high" as const, suggestion: "改为新标题" }],
};

test("无效请求和空勾选返回 400，不调用模型", async () => {
  let calls = 0;
  const revise = async () => { calls++; throw new Error("不应调用"); };
  for (const body of [null, {}, { ...input, issues: [] }]) {
    assert.equal((await handleReviewRevision(body, revise)).status, 400);
  }
  assert.equal(calls, 0);
});

test("模型只收到所选问题与材料，接口成功返回定点修改", async () => {
  const provider: LLMProvider = {
    async generateStructuredOutput<T>(messages: { content: string }[]) {
      const material = JSON.parse(messages[1].content);
      assert.deepEqual(material.issues, input.issues);
      assert.equal(material.llm, undefined);
      assert.equal(JSON.stringify(material).includes("test-secret"), false);
      return { edits: [{ issueIndex: 0, field: "title", before: "旧标题", after: "新标题" }] } as T;
    },
    async generateText() { throw new Error("不应整篇改写"); },
  };
  const result = await handleReviewRevision({ ...input, llm: { apiKey: "test-secret" } }, request => reviseReviewedContent(request, provider));
  assert.equal(result.status, 200);
  assert.ok("draft" in result.payload);
  assert.equal(result.payload.draft.title, "新标题");
  assert.equal(result.payload.draft.body, input.draft.body);
  assert.equal(result.payload.draft.digest, input.draft.digest);
  assert.equal(input.draft.title, "旧标题");
});

test("模型越界修改或服务失败返回错误，原稿不变", async () => {
  const before = JSON.stringify(input);
  const provider: LLMProvider = {
    async generateStructuredOutput<T>() { return { edits: [{ issueIndex: 2, field: "title", before: "旧标题", after: "新标题" }] } as T; },
    async generateText() { return ""; },
  };
  assert.equal((await handleReviewRevision(input, request => reviseReviewedContent(request, provider))).status, 500);
  assert.equal((await handleReviewRevision(input, async () => { throw new Error("服务不可用"); })).status, 500);
  assert.equal(JSON.stringify(input), before);
});
