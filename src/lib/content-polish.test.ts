import assert from "node:assert/strict";
import test from "node:test";
import { latestPolishByContent } from "./content-polish";

test("marks only successful rewrite history and keeps the latest time per article", () => {
  const result = latestPolishByContent([
    { contentItemId: "a", changeSource: "ai_rewrite", createdAt: "2026-09-08T02:00:00Z" },
    { contentItemId: "b", changeSource: "user_edit", createdAt: "2026-09-08T04:00:00Z" },
    { contentItemId: "a", changeSource: "ai_rewrite", createdAt: "2026-09-08T01:00:00Z" },
    { contentItemId: "c", changeSource: "ai_generate", createdAt: "2026-09-08T03:00:00Z" },
    { contentItemId: "a", changeSource: "user_edit", createdAt: "2026-09-08T04:00:00Z" },
  ]);
  assert.deepEqual(result, { a: "2026-09-08T02:00:00Z" });
  assert.deepEqual(latestPolishByContent([]), {});
});
