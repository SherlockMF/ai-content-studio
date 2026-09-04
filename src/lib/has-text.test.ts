import assert from "node:assert/strict";
import test from "node:test";
import { hasText } from "./has-text";

test("hasText treats missing body as empty without throwing", () => {
  assert.equal(hasText(undefined), false);
  assert.equal(hasText(null), false);
  assert.equal(hasText(""), false);
  assert.equal(hasText("  "), false);
  assert.equal(hasText("正文"), true);
});
