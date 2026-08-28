import { createHash } from "node:crypto";
import { matchAiHotspotText } from "@/lib/hotspots/dictionary";
import { HotspotFeedEntry, HotspotItem, HOTSPOT_MAX_ITEMS } from "@/lib/hotspots/types";
import { HotspotSourceConfig } from "@/lib/hotspots/types";

function hotspotItemId(url: string) {
  return `hs-${createHash("sha256").update(url).digest("hex").slice(0, 16)}`;
}

export function selectRelevantHotspotItems(
  groups: Array<{ source: HotspotSourceConfig; entries: HotspotFeedEntry[] }>
): HotspotItem[] {
  const buckets = new Map<string, HotspotItem>();

  for (const group of groups) {
    for (const entry of group.entries) {
      const text = `${entry.title} ${entry.summary ?? ""}`;
      const matched = matchAiHotspotText(text);
      if (matched.relevance === "弱") continue;

      const id = hotspotItemId(entry.url);
      const existing = buckets.get(id);
      const heat = matched.matchedTerms.length * 100 + (existing?.heat ?? 0);

      buckets.set(id, {
        id,
        sourceId: group.source.id,
        sourceName: group.source.name,
        title: entry.title,
        url: entry.url,
        ...(entry.summary ? { summary: entry.summary } : {}),
        ...(entry.publishedAt ? { publishedAt: entry.publishedAt } : {}),
        relevance: matched.relevance,
        matchedTerms: [...new Set([...(existing?.matchedTerms ?? []), ...matched.matchedTerms])],
        heat,
        provider: "rss",
      });
    }
  }

  return [...buckets.values()]
    .sort((a, b) => b.heat - a.heat)
    .slice(0, HOTSPOT_MAX_ITEMS);
}

function normalizeHotspotUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function mergeHotspotItems(groups: HotspotItem[][]): HotspotItem[] {
  const buckets = new Map<string, HotspotItem>();
  for (const items of groups) {
    for (const item of items) {
      const key = normalizeHotspotUrl(item.url);
      const existing = buckets.get(key);
      if (!existing || item.heat > existing.heat) {
        buckets.set(key, item);
      }
    }
  }
  return [...buckets.values()]
    .sort((a, b) => b.heat - a.heat)
    .slice(0, HOTSPOT_MAX_ITEMS);
}
