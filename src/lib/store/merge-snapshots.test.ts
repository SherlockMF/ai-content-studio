import assert from "node:assert/strict";
import test from "node:test";
import { mergeSnapshots } from "./merge-snapshots";
import type { AppState } from "./app-store";
import { DEMO_CONTENT_ITEMS, DEMO_PUBLISH_VOICE } from "@/lib/mock-data";

test("merge keeps newer article and images, adds missing drafts, skips older conflicting history and current voice", () => {
  const item = { ...DEMO_CONTENT_ITEMS[0], id: "a", body: "新版![图](/article-assets/a.png)", updatedAt: "2026-09-09T01:00:00Z" };
  const current: AppState = { publishVoice: DEMO_PUBLISH_VOICE, contentItems: [item], topics: [], materials: [], reviews: [], versions: [], seedFingerprint: "current" };
  const incoming: AppState = { ...current, contentItems: [{ ...item, body: "旧版", updatedAt: "2026-09-08T01:00:00Z" }, { ...item, id: "b" }] };
  const result = mergeSnapshots(current, incoming);
  assert.equal(result.added, 1);
  assert.equal(result.state.contentItems.find((i) => i.id === "a")?.body, item.body);
  assert.equal(result.state.versions.length, 0);
  assert.equal(result.state.seedFingerprint, "current");
  assert.equal(mergeSnapshots(result.state, incoming).state.versions.length, 0);
  assert.equal(mergeSnapshots(incoming, current).state.contentItems.find((i) => i.id === "a")?.body, item.body);
});
