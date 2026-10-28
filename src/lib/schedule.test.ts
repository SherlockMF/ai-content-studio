import assert from "node:assert/strict";
import test from "node:test";
import {
  applyScheduleWithCascade,
  buildScheduleHeatmap,
  getScheduleHeatTone,
  getScheduleHeatCounts,
  remapCascadeSchedules,
} from "@/lib/schedule";
import type { ContentItem } from "@/types/domain";

function item(
  id: string,
  scheduledAt: string | null,
  status: ContentItem["status"] = "编辑中"
): ContentItem {
  return {
    id,
    workspaceId: "ws",
    topicId: `t_${id}`,
    platform: "wechat",
    source: "imported",
    title: id,
    body: "body",
    status,
    scheduledAt,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

test("buildScheduleHeatmap lights cells with scheduled posts in 7-day columns", () => {
  const items: ContentItem[] = [item("a", "2026-09-07T12:00:00.000Z")];

  const { weeks, byDate } = buildScheduleHeatmap(items, {
    anchor: new Date(2026, 8, 7),
    pastWeeks: 1,
    futureWeeks: 1,
  });

  assert.ok(weeks.length >= 2);
  assert.equal(weeks[0]?.length, 7);
  assert.equal(byDate.get("2026-09-07")?.[0]?.id, "a");

  const lit = weeks.flat().filter((cell) => cell.items.length > 0);
  assert.equal(lit.length, 1);
  assert.equal(lit[0]?.dateKey, "2026-09-07");
});

test("heatmap distinguishes empty drafts from unpublished and published posts", () => {
  const emptyDraft = { ...item("empty", "2026-09-07T12:00:00.000Z"), body: "  \n" };
  const draft = item("draft", "2026-09-08T12:00:00.000Z");
  const published = { ...item("published", "2026-09-09T12:00:00.000Z", "已归档"), body: "" };
  assert.equal(getScheduleHeatTone([]), "empty");
  assert.equal(getScheduleHeatTone([emptyDraft]), "empty");
  assert.equal(getScheduleHeatTone([emptyDraft, draft]), "scheduled");
  assert.equal(getScheduleHeatTone([draft, published]), "published");
  assert.deepEqual(getScheduleHeatCounts([emptyDraft, draft, published, item("unscheduled", null)]), {
    published: 1,
    scheduled: 1,
  });
});

test("applyScheduleWithCascade locks one date and delays the rest to later weekdays", () => {
  const items = [
    item("a", "2026-09-07T12:00:00.000Z"),
    item("b", "2026-09-08T12:00:00.000Z"),
    item("c", "2026-09-09T12:00:00.000Z"),
  ];
  const next = applyScheduleWithCascade(items, {
    lockedId: "a",
    lockedDateKey: "2026-09-07",
    from: new Date(2026, 8, 7),
  });
  assert.equal(next.find((x) => x.id === "a")?.scheduledAt?.slice(0, 10), "2026-09-07");
  assert.equal(next.find((x) => x.id === "b")?.scheduledAt?.slice(0, 10), "2026-09-08");
  assert.equal(next.find((x) => x.id === "c")?.scheduledAt?.slice(0, 10), "2026-09-09");
});

test("applyScheduleWithCascade pushes only same-or-later items after lock date", () => {
  const items = [
    item("a", "2026-09-07T12:00:00.000Z"),
    item("b", "2026-09-08T12:00:00.000Z"),
    item("c", "2026-09-09T12:00:00.000Z"),
  ];
  const next = applyScheduleWithCascade(items, {
    lockedId: "b",
    lockedDateKey: "2026-09-10",
    from: new Date(2026, 8, 7),
  });
  assert.equal(next.find((x) => x.id === "a")?.scheduledAt?.slice(0, 10), "2026-09-07");
  assert.equal(next.find((x) => x.id === "b")?.scheduledAt?.slice(0, 10), "2026-09-10");
  assert.equal(next.find((x) => x.id === "c")?.scheduledAt?.slice(0, 10), "2026-09-11");
});

test("remapCascadeSchedules packs remaining movable items onto consecutive weekdays", () => {
  const items = [
    item("a", "2026-09-07T12:00:00.000Z"),
    item("gone-slot", null),
    item("c", "2026-09-11T12:00:00.000Z"),
    item("pub", "2026-09-08T12:00:00.000Z", "公众号已发布"),
  ];
  const next = remapCascadeSchedules(
    items.filter((x) => x.id !== "gone-slot"),
    new Date(2026, 8, 7)
  );
  assert.equal(next.find((x) => x.id === "pub")?.scheduledAt?.slice(0, 10), "2026-09-08");
  assert.equal(next.find((x) => x.id === "a")?.scheduledAt?.slice(0, 10), "2026-09-07");
  assert.equal(next.find((x) => x.id === "c")?.scheduledAt?.slice(0, 10), "2026-09-09");
});
