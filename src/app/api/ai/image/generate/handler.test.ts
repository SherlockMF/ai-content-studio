import assert from "node:assert/strict";
import test from "node:test";
import { handleImageGenerateRequest } from "./handler";

test("image generate rejects missing prompt", async () => {
  const result = await handleImageGenerateRequest({
    purpose: "cover",
    prompt: "   ",
  });
  assert.equal(result.status, 400);
});

test("image generate rejects missing api key", async () => {
  const previous = process.env.DASHSCOPE_API_KEY;
  const previousFallback = process.env.IMAGE_API_KEY;
  delete process.env.DASHSCOPE_API_KEY;
  delete process.env.IMAGE_API_KEY;
  try {
    const result = await handleImageGenerateRequest({
      purpose: "cover",
      prompt: "鲸鱼驾驭骏马，华丽概念插画",
      image: { apiKey: "", baseUrl: "https://dashscope.aliyuncs.com" },
    });
    assert.equal(result.status, 400);
    assert.match(String((result.payload as { message?: string }).message), /DashScope/);
  } finally {
    if (previous === undefined) delete process.env.DASHSCOPE_API_KEY;
    else process.env.DASHSCOPE_API_KEY = previous;
    if (previousFallback === undefined) delete process.env.IMAGE_API_KEY;
    else process.env.IMAGE_API_KEY = previousFallback;
  }
});

test("image generate stores dashscope result via asset put", async () => {
  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
  ]);
  const result = await handleImageGenerateRequest(
    {
      purpose: "cover",
      prompt: "鲸鱼驾驭骏马",
      image: {
        apiKey: "sk-test",
        baseUrl: "https://dashscope.aliyuncs.com",
        model: "qwen-image-3.0",
      },
    },
    {
      generate: async () => ({
        imageUrl: "https://example.com/out.png",
        raw: {},
      }),
      fetchImpl: (async () =>
        new Response(png, { status: 200, headers: { "Content-Type": "image/png" } })) as typeof fetch,
      putAsset: async () => ({
        url: "/article-assets/test.png",
        fileName: "test.png",
        contentHash: "abc",
        bytes: png.byteLength,
        mimeType: "image/png",
      }),
    }
  );

  assert.equal(result.status, 200);
  assert.deepEqual(result.payload, {
    url: "/article-assets/test.png",
    fileName: "test.png",
    contentHash: "abc",
  });
});
