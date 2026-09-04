import assert from "node:assert/strict";
import test from "node:test";
import type { CoverImageVariant } from "@/lib/illustrations/cover";
import {
  clearCoverAnalysisEntry,
  patchCoverAnalysisVariant,
  upsertCoverAnalysisEntry,
} from "./cover-analysis-cache";

const variantA: CoverImageVariant = {
  id: "cover_1",
  styleLabel: "概念插画封面",
  overlayText: "短文案",
  gptPrompt: "原始提示词",
  altText: "封面",
};

test("upsert keeps other topics when saving cover analysis", () => {
  const first = upsertCoverAnalysisEntry(
    {},
    "topic_a",
    { variants: [variantA], cacheKey: "key-a", summary: "A" }
  );
  const next = upsertCoverAnalysisEntry(first, "topic_b", {
    variants: [{ ...variantA, id: "cover_b", gptPrompt: "B 提示词" }],
    cacheKey: "key-b",
    summary: "B",
  });

  assert.equal(next.topic_a?.summary, "A");
  assert.equal(next.topic_b?.summary, "B");
  assert.equal(next.topic_a?.variants[0]?.gptPrompt, "原始提示词");
});

test("patch only updates the matched variant for the topic", () => {
  const cache = upsertCoverAnalysisEntry(
    {},
    "topic_a",
    {
      variants: [
        variantA,
        { ...variantA, id: "cover_2", gptPrompt: "第二套" },
      ],
      cacheKey: "key-a",
    }
  );
  const next = patchCoverAnalysisVariant(cache, "topic_a", "cover_1", {
    gptPrompt: "优化后的提示词",
  });

  assert.equal(next.topic_a?.variants[0]?.gptPrompt, "优化后的提示词");
  assert.equal(next.topic_a?.variants[1]?.gptPrompt, "第二套");
});

test("clear removes only the requested topic entry", () => {
  const cache = upsertCoverAnalysisEntry(
    upsertCoverAnalysisEntry(
      {},
      "topic_a",
      { variants: [variantA], cacheKey: "key-a" }
    ),
    "topic_b",
    { variants: [variantA], cacheKey: "key-b" }
  );
  const next = clearCoverAnalysisEntry(cache, "topic_a");
  assert.equal(next.topic_a, undefined);
  assert.ok(next.topic_b);
});
