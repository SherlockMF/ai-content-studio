import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_PUBLISH_VOICE } from "@/lib/mock-data";
import { validResult } from "@/lib/xiaohongshu/test-fixtures";
import { handleXiaohongshuRequest } from "./handler";

const validRequest = {
  sourceContent: {
    id: "wechat-1",
    title: "公众号标题",
    digest: "公众号摘要",
    body: "公众号正文包含 25 项任务。",
    cta: "欢迎讨论",
    supplementaryNotes: "25 项任务是原文事实。",
  },
  voice: DEMO_PUBLISH_VOICE,
  llm: null,
};

test("rejects an empty source body without calling the generator", async () => {
  let called = false;
  const response = await handleXiaohongshuRequest(
    {
      sourceContent: { id: "wechat-1", title: "标题", body: "" },
      voice: DEMO_PUBLISH_VOICE,
      llm: null,
    },
    async () => {
      called = true;
      throw new Error("must not run");
    }
  );
  assert.equal(response.status, 400);
  assert.equal(called, false);
  assert.deepEqual(response.payload, { message: "请先填写公众号正文" });
});

test("returns the validated generator result", async () => {
  const response = await handleXiaohongshuRequest(validRequest, async () => validResult);
  assert.equal(response.status, 200);
  assert.deepEqual(response.payload, validResult);
});

test("turns generator errors into a stable 500 response", async () => {
  const response = await handleXiaohongshuRequest(validRequest, async () => {
    throw new Error("模型暂时不可用");
  });
  assert.equal(response.status, 500);
  assert.deepEqual(response.payload, { message: "模型暂时不可用" });
});
