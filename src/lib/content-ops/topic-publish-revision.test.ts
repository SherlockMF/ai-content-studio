import assert from "node:assert/strict";
import test from "node:test";
import {
  detectOffPlatformDiversion,
  formatDiversionHint,
} from "./topic-publish-revision";

test("无引流文案不报命中", () => {
  assert.deepEqual(
    detectOffPlatformDiversion("AI 商品图看着能用，商家却不敢用。先守住商品身份。"),
    []
  );
});

test("微信号与外链会被检出", () => {
  const hits = detectOffPlatformDiversion("详情加我微信：abc_123 或打开 https://example.com");
  assert.ok(hits.some((h) => h.id === "wechat-id"));
  assert.ok(hits.some((h) => h.id === "url"));
  assert.match(formatDiversionHint(hits) ?? "", /限制推荐/);
});

test("二维码与邀请码会被检出", () => {
  const hits = detectOffPlatformDiversion("扫码添加好友，邀请码 8821");
  assert.ok(hits.some((h) => h.id === "qr"));
  assert.ok(hits.some((h) => h.id === "invite"));
});
