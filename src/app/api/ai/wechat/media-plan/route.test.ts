import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "./route";

test("rejects incomplete media requests before contacting a model", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => { throw new Error("unexpected request"); });
  const response = await POST(new Request("http://localhost/api/ai/wechat/media-plan", { method: "POST", body: "{}" }));
  assert.equal(response.status, 400);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("keeps source URLs from saved images and regenerates only the mismatched plan entry", async (t) => {
  const images = [0, 1, 2, 3].map((index) => ({
    sourceIndex: index, action: index === 2 ? "generate" : "keep",
    purpose: index === 0 ? "cover" : "illustration", altText: index === 0 ? "公众号封面" : `图${index}`,
    anchorSnippet: index === 0 ? "" : `第${index}段。`, prompt: `图${index}提示词`, sourceUrl: "/invented.png",
  }));
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ images }) } }] })));
  const previousBody = images.map((image, index) => `![${image.altText}](/article-assets/${index}.png)`).join("\n");
  const response = await POST(new Request("http://localhost/api/ai/wechat/media-plan", {
    method: "POST", body: JSON.stringify({ title: "标题", body: "第1段。\n第2段。\n第3段。", previousBody, llm: { apiKey: "test-key" } }),
  }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.images.map((image: { sourceUrl: string }) => image.sourceUrl), [0, 1, 2, 3].map(i => `/article-assets/${i}.png`));
  assert.deepEqual(result.images.map((image: { action: string }) => image.action), ["keep", "keep", "generate", "keep"]);
});
