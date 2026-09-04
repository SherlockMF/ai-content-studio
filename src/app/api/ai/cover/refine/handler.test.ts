import assert from "node:assert/strict";
import test from "node:test";
import { handleCoverRefineRequest } from "./handler";

const validRequest = {
  title: "Agent = Model + Harness",
  styleLabel: "概念插画封面",
  overlayText: "Agent = Model + Harness",
  gptPrompt: "原始提示词",
  suggestion: "背景改成深蓝，主图标换成电路板",
  llm: null,
};

test("rejects blank suggestion without calling refine", async () => {
  let called = false;
  const response = await handleCoverRefineRequest(
    { ...validRequest, suggestion: "  " },
    async () => {
      called = true;
      throw new Error("must not run");
    }
  );
  assert.equal(response.status, 400);
  assert.equal(called, false);
  assert.deepEqual(response.payload, { message: "请先填写修改建议" });
});

test("rejects blank gptPrompt without calling refine", async () => {
  let called = false;
  const response = await handleCoverRefineRequest(
    { ...validRequest, gptPrompt: "" },
    async () => {
      called = true;
      throw new Error("must not run");
    }
  );
  assert.equal(response.status, 400);
  assert.equal(called, false);
  assert.deepEqual(response.payload, { message: "缺少原提示词" });
});

test("returns refined prompt payload", async () => {
  const refined = {
    gptPrompt: "优化后的提示词",
    overlayText: "新短文案",
  };
  const response = await handleCoverRefineRequest(validRequest, async () => refined);
  assert.equal(response.status, 200);
  assert.deepEqual(response.payload, refined);
});

test("maps refine errors to 500", async () => {
  const response = await handleCoverRefineRequest(validRequest, async () => {
    throw new Error("模型暂时不可用");
  });
  assert.equal(response.status, 500);
  assert.deepEqual(response.payload, { message: "模型暂时不可用" });
});
