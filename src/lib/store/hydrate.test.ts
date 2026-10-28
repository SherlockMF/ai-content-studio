import assert from "node:assert/strict";
import test from "node:test";
import { CURRENT_SEED_FINGERPRINT } from "@/lib/seed/restore";
import { PROJECT_DRAFT_OVERLAYS } from "@/lib/draft-overlays";
import type { ContentItem } from "@/types/domain";
import { applyProjectDraftOverlays, migrateState, parseStoredState, seedData } from "./hydrate";

const seed = seedData();

test("stored layouts survive reload independently and legacy/invalid settings use defaults", () => {
  const original = seed.contentItems[0];
  const base = { ...seed, seedFingerprint: CURRENT_SEED_FINGERPRINT, contentItems: [
    { ...original, id: "layout_a", platform: "wechat", wechatLayout: { theme: "editorial", numberSections: true, emphasize: false } },
    { ...original, id: "layout_b", platform: "wechat", wechatLayout: { theme: "tutorial-cards", numberSections: false, emphasize: true } },
    { ...original, id: "layout_legacy", platform: "wechat", wechatLayout: undefined },
    { ...original, id: "layout_invalid", platform: "wechat", wechatLayout: { theme: "unknown", numberSections: "false", emphasize: null } },
  ] };
  const { state } = parseStoredState(JSON.stringify(base));
  assert.deepEqual(state.contentItems.find(item => item.id === "layout_a")?.wechatLayout, base.contentItems[0].wechatLayout);
  assert.deepEqual(state.contentItems.find(item => item.id === "layout_b")?.wechatLayout, base.contentItems[1].wechatLayout);
  for (const id of ["layout_legacy", "layout_invalid"]) {
    assert.deepEqual(state.contentItems.find(item => item.id === id)?.wechatLayout, {
      theme: "tech-eval", numberSections: false, emphasize: true,
    });
  }
});

test("first reload and seed restoration preserve saved article layouts", () => {
  const layout = { theme: "editorial" as const, numberSections: true, emphasize: false };
  const item = { ...seed.contentItems[0], wechatLayout: layout };
  const synced = migrateState({ ...seed, contentItems: [item] });
  assert.deepEqual(synced.contentItems.find(value => value.id === item.id)?.wechatLayout, layout);
  const restored = migrateState({ ...seed, seedFingerprint: CURRENT_SEED_FINGERPRINT, contentItems: [{ ...item, body: "短稿" }] });
  assert.deepEqual(restored.contentItems.find(value => value.id === item.id)?.wechatLayout, layout);
});

test("parseStoredState falls back to seed data when storage is empty", () => {
  const { state, corrupt } = parseStoredState(null);
  assert.equal(corrupt, false);
  assert.equal(state.contentItems.length, seed.contentItems.length);
});

test("parseStoredState flags corrupt JSON", () => {
  const { state, corrupt } = parseStoredState("{not json");
  assert.equal(corrupt, true);
  assert.equal(state.publishVoice.accountName, seed.publishVoice.accountName);
});

test("parseStoredState ignores snapshots without voice or materials", () => {
  const { state, corrupt } = parseStoredState(JSON.stringify({ contentItems: [] }));
  assert.equal(corrupt, false);
  assert.equal(state.contentItems.length, seed.contentItems.length);
});

test("migrateState normalizes legacy reviews and statuses and stamps the seed fingerprint", () => {
  const legacyItem = { ...seed.contentItems[0], id: "user_item", status: "已发布" } as unknown as ContentItem;
  const state = migrateState({
    publishVoice: seed.publishVoice,
    materials: seed.materials,
    topics: seed.topics,
    contentItems: [legacyItem],
    versions: [],
    reviews: [{ id: "r1", contentItemId: "user_item" } as never],
  });
  assert.equal(state.seedFingerprint, CURRENT_SEED_FINGERPRINT);
  assert.deepEqual(state.reviews[0].issues, []);
  assert.equal(state.reviews[0].score, 0);
  const migrated = state.contentItems.find((item) => item.id === "user_item");
  assert.ok(migrated);
  assert.equal(migrated.status, "已归档");
  assert.ok(migrated.source);
});

test("migrateState keeps user edits when the seed fingerprint is current", () => {
  const original = seed.contentItems[0];
  const edited = { ...original, body: `${original.body}\n\n用户追加的段落`, updatedAt: "2099-01-01T00:00:00.000Z" };
  const state = migrateState({ ...seed, contentItems: [edited], seedFingerprint: CURRENT_SEED_FINGERPRINT });
  assert.equal(state.contentItems.find((item) => item.id === edited.id)?.body, edited.body);
});

test("applyProjectDraftOverlays applies once and records the overlay id", async () => {
  const overlay = PROJECT_DRAFT_OVERLAYS[0];
  const target = { ...seed.contentItems[0], id: "overlay_target", platform: "wechat", title: `${overlay.titleIncludes}？`, body: "![x](待替换-公众号配图-1)" } as ContentItem;
  const base = { ...seed, contentItems: [target] };
  let fetches = 0;
  const fetchText = async () => { fetches += 1; return "![封面](/article-assets/img_a.png)\n\n新正文"; };

  const first = await applyProjectDraftOverlays(base, fetchText);
  assert.match(first.contentItems[0].body, /新正文/);
  assert.deepEqual(first.appliedOverlayIds, [overlay.id]);

  const second = await applyProjectDraftOverlays({ ...first, contentItems: [{ ...target }] }, fetchText);
  assert.equal(fetches, 1);
  assert.equal(second.contentItems[0].body, target.body);
});

test("applyProjectDraftOverlays skips fetching when no draft matches and retries after fetch failure", async () => {
  let fetches = 0;
  const noTarget = await applyProjectDraftOverlays({ ...seed, contentItems: [] }, async () => { fetches += 1; return "x"; });
  assert.equal(fetches, 0);
  assert.equal(noTarget.appliedOverlayIds, undefined);

  const overlay = PROJECT_DRAFT_OVERLAYS[0];
  const target = { ...seed.contentItems[0], platform: "wechat", title: overlay.titleIncludes } as ContentItem;
  const failed = await applyProjectDraftOverlays({ ...seed, contentItems: [target] }, async () => { throw new Error("offline"); });
  assert.equal(failed.appliedOverlayIds, undefined);
});
