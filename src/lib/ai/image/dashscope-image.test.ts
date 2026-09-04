import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDashScopeImageRequestBody,
  buildWanxImageRequestBody,
  extractDashScopeImageUrl,
  extractWanxResultUrl,
  extractWanxTaskId,
  isAllowedImageBaseUrl,
} from "./dashscope-image";

test("buildDashScopeImageRequestBody uses multimodal messages shape", () => {
  const body = buildDashScopeImageRequestBody({
    model: "qwen-image-3.0",
    prompt: "鲸鱼驾驭骏马",
    size: "1472*624",
  });
  assert.equal(body.model, "qwen-image-3.0");
  assert.deepEqual(body.input.messages[0]?.content, [{ text: "鲸鱼驾驭骏马" }]);
  assert.equal(body.parameters.size, "1472*624");
  assert.equal(body.parameters.n, 1);
  assert.equal(body.parameters.watermark, false);
});

test("buildWanxImageRequestBody uses text2image prompt shape and truncates", () => {
  const longPrompt = "暖色讲解页。".repeat(200);
  const body = buildWanxImageRequestBody({
    model: "wanx-v1",
    prompt: longPrompt,
    size: "900*1200",
  });
  assert.equal(body.model, "wanx-v1");
  assert.equal(body.parameters.size, "768*1152");
  assert.equal(body.parameters.n, 1);
  assert.ok(typeof body.input.prompt === "string");
  assert.ok(body.input.prompt.length <= 800);
});

test("extractDashScopeImageUrl reads content.image", () => {
  const url = extractDashScopeImageUrl({
    output: {
      choices: [
        {
          message: {
            content: [{ image: "https://example.com/a.png" }],
          },
        },
      ],
    },
  });
  assert.equal(url, "https://example.com/a.png");
});

test("extractWanxTaskId and result url", () => {
  assert.equal(
    extractWanxTaskId({ output: { task_id: "task-1", task_status: "PENDING" } }),
    "task-1"
  );
  assert.equal(
    extractWanxResultUrl({
      output: {
        task_status: "SUCCEEDED",
        results: [{ url: "https://example.com/wanx.png" }],
      },
    }),
    "https://example.com/wanx.png"
  );
  assert.equal(
    extractWanxResultUrl({
      output: { task_status: "RUNNING", results: [] },
    }),
    null
  );
});

test("isAllowedImageBaseUrl allows dashscope hosts", () => {
  assert.equal(isAllowedImageBaseUrl("https://dashscope.aliyuncs.com"), true);
  assert.equal(isAllowedImageBaseUrl("https://dashscope-intl.aliyuncs.com"), true);
  assert.equal(isAllowedImageBaseUrl("https://evil.example"), false);
});
