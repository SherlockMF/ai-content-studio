import { AI_HOTSPOT_SOURCES } from "@/lib/hotspots/sources";
import { fetchAIHotHotspots } from "@/lib/hotspots/aihot";
import { fetchFeedEntries } from "@/lib/hotspots/feed";
import { mergeHotspotItems, selectRelevantHotspotItems } from "@/lib/hotspots/relevance";
import {
  createSnapshotExpiry,
  createSnapshotId,
  readHotspotSnapshot,
  writeHotspotSnapshot,
} from "@/lib/hotspots/cache";
import { HotspotSnapshot } from "@/lib/hotspots/types";

export async function researchHotspots(forceRefresh = false) {
  const now = Date.now();
  const cached = readHotspotSnapshot(now);
  if (!forceRefresh && cached.snapshot && !cached.expired) {
    return { snapshot: cached.snapshot, cacheHit: true, stale: false };
  }

  const enabledSources = AI_HOTSPOT_SOURCES.filter((source) => source.enabled);
  const groups: Array<{
    source: (typeof enabledSources)[number];
    entries: Awaited<ReturnType<typeof fetchFeedEntries>>;
  }> = [];
  const sourceReports: HotspotSnapshot["sourceReports"] = [];

  await Promise.all(
    enabledSources.map(async (source) => {
      try {
        const entries = await fetchFeedEntries(source.url);
        groups.push({ source, entries });
        sourceReports.push({
          sourceId: source.id,
          sourceName: source.name,
          status: "ok",
          itemCount: entries.length,
        });
      } catch (error) {
        sourceReports.push({
          sourceId: source.id,
          sourceName: source.name,
          status: "failed",
          itemCount: 0,
          message: error instanceof Error ? error.message : "抓取失败",
        });
      }
    })
  );

  try {
    const aihot = await fetchAIHotHotspots();
    sourceReports.push({
      sourceId: "aihot",
      sourceName: "AIHOT",
      status: "ok",
      itemCount: aihot.items.length,
      message: `热点榜 ${aihot.hotTopicCount} · 精选 ${aihot.selectedCount}`,
    });
    const rssItems = selectRelevantHotspotItems(groups);
    const items = mergeHotspotItems([aihot.items, rssItems]);
    const snapshot: HotspotSnapshot = {
      id: createSnapshotId(),
      fetchedAt: new Date(now).toISOString(),
      expiresAt: createSnapshotExpiry(now),
      items,
      sourceReports,
    };
    writeHotspotSnapshot(snapshot);
    return { snapshot, cacheHit: false, stale: false };
  } catch (error) {
    sourceReports.push({
      sourceId: "aihot",
      sourceName: "AIHOT",
      status: "failed",
      itemCount: 0,
      message: error instanceof Error ? error.message : "AIHOT 抓取失败",
    });
  }

  const items = selectRelevantHotspotItems(groups);
  const snapshot: HotspotSnapshot = {
    id: createSnapshotId(),
    fetchedAt: new Date(now).toISOString(),
    expiresAt: createSnapshotExpiry(now),
    items,
    sourceReports,
  };

  writeHotspotSnapshot(snapshot);
  return { snapshot, cacheHit: false, stale: false };
}
