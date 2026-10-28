import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { defineHandler, HandlerError, runHandler } from "./handler";

const config = {
  schema: z.object({ name: z.string() }),
  invalidMessage: "缺少名称",
  failureMessage: "失败",
};

test("runHandler returns 400 with invalidMessage when schema fails", async () => {
  const result = await runHandler({}, { ...config, run: () => "ok" });
  assert.deepEqual(result, { status: 400, payload: { message: "缺少名称" } });
});

test("runHandler maps HandlerError and errorStatus, defaults to 500", async () => {
  const handled = await runHandler({ name: "a" }, { ...config, run: () => { throw new HandlerError("请先选择", 422); } });
  assert.deepEqual(handled, { status: 422, payload: { message: "请先选择" } });

  const mapped = await runHandler({ name: "a" }, {
    ...config,
    errorStatus: (message) => (message.includes("未配置") ? 400 : undefined),
    run: () => { throw new Error("未配置 Key"); },
  });
  assert.equal(mapped.status, 400);

  const failed = await runHandler({ name: "a" }, { ...config, run: () => { throw "boom"; } });
  assert.deepEqual(failed, { status: 500, payload: { message: "失败" } });
});

test("defineHandler POST treats unreadable JSON as an empty body", async () => {
  const { POST } = defineHandler({ ...config, run: ({ name }) => ({ hello: name }) });
  const bad = await POST(new Request("http://localhost/api", { method: "POST", body: "not json" }));
  assert.equal(bad.status, 400);
  const ok = await POST(new Request("http://localhost/api", { method: "POST", body: JSON.stringify({ name: "x" }) }));
  assert.deepEqual(await ok.json(), { hello: "x" });
});
