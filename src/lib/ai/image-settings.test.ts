import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_IMAGE_GEN_SETTINGS,
  IMAGE_SIZE_BY_PURPOSE,
  normalizeImageGenSettings,
  resolveImageSize,
  resolveWanxV1Size,
} from "./image-settings";

test("normalizeImageGenSettings defaults to qwen-image-3.0 on dashscope", () => {
  const settings = normalizeImageGenSettings({});
  assert.equal(settings.provider, "dashscope");
  assert.equal(settings.model, "qwen-image-3.0");
  assert.equal(settings.baseUrl, DEFAULT_IMAGE_GEN_SETTINGS.baseUrl);
  assert.equal(settings.apiKey, "");
});

test("normalizeImageGenSettings accepts pro model and trims baseUrl slash", () => {
  const settings = normalizeImageGenSettings({
    model: "qwen-image-3.0-pro",
    baseUrl: "https://dashscope.aliyuncs.com/",
    apiKey: " sk-test ",
  });
  assert.equal(settings.model, "qwen-image-3.0-pro");
  assert.equal(settings.baseUrl, "https://dashscope.aliyuncs.com");
  assert.equal(settings.apiKey, "sk-test");
});

test("normalizeImageGenSettings accepts wanx-v1 and rejects unknown model", () => {
  assert.equal(normalizeImageGenSettings({ model: "wanx-v1" }).model, "wanx-v1");
  const settings = normalizeImageGenSettings({ model: "flux-schnell" as never });
  assert.equal(settings.model, "qwen-image-3.0");
});

test("resolveImageSize maps purpose defaults and custom override", () => {
  assert.equal(resolveImageSize("cover"), IMAGE_SIZE_BY_PURPOSE.cover);
  assert.equal(resolveImageSize("illustration"), IMAGE_SIZE_BY_PURPOSE.illustration);
  assert.equal(resolveImageSize("xiaohongshu"), IMAGE_SIZE_BY_PURPOSE.xiaohongshu);
  assert.equal(resolveImageSize("cover", "1664*704"), "1664*704");
});

test("resolveWanxV1Size maps portrait and landscape to supported enums", () => {
  assert.equal(resolveWanxV1Size("768*1152"), "768*1152");
  assert.equal(resolveWanxV1Size("1472*624"), "1280*720");
  assert.equal(resolveWanxV1Size("900*1200"), "768*1152");
});
