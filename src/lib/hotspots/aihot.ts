import { HotspotItem } from "@/lib/hotspots/types";

const AIHOT_BASE_URL = "https://aihot.virxact.com";
const AIHOT_FETCH_TIMEOUT_MS = 12_000;

interface AIHotLinks {
  aihot?: string;
  original?: string;
  story?: string;
}

interface AIHotHotTopic {
  rank: number;
  id: string;
  title: string;
  source?: { name?: string };
  links?: AIHotLinks;
  sourceCount?: number;
  sourceNames?: string[];
  latestAt?: string;
}

interface AIHotSelectedItem {
  id: string;
  title: string;
  summary?: string;
  reason?: string;
  score?: number;
  source?: { name?: string };
  links?: AIHotLinks;
  publishedAt?: string;
  discoveredAt?: string;
}

async function fetchAIHotJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AIHOT_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${AIHOT_BASE_URL}${path}`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "zuzhijinhua-hotspot-client/1.0",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`AIHOT HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function mapHotTopic(item: AIHotHotTopic): HotspotItem {
  const sourceNames = item.sourceNames ?? [];
  const summaryParts = [
    item.sourceCount ? `${item.sourceCount} 个独立信源共同印证` : null,
    sourceNames.length ? `信源：${sourceNames.slice(0, 4).join("、")}${sourceNames.length > 4 ? "…" : ""}` : null,
  ].filter(Boolean);

  return {
    id: `aihot-hot-${item.id}`,
    sourceId: "aihot",
    sourceName: "AIHOT 热点榜",
    title: item.title,
    url: item.links?.original || item.links?.aihot || `${AIHOT_BASE_URL}/hot`,
    summary: summaryParts.join("\n"),
    publishedAt: item.latestAt,
    relevance: "强",
    matchedTerms: ["AIHOT", "热点榜"],
    heat: 2000 - item.rank * 100 + (item.sourceCount ?? 0) * 20,
    leverageHint:
      sourceNames.length >= 2
        ? `多源热议事件，可从「${item.source?.name ?? sourceNames[0]}」等角度切入`
        : "AI 行业多源热议事件",
    provider: "aihot",
  };
}

function mapSelectedItem(item: AIHotSelectedItem): HotspotItem {
  const score = item.score ?? 60;
  return {
    id: `aihot-item-${item.id}`,
    sourceId: "aihot",
    sourceName: item.source?.name ? `AIHOT · ${item.source.name}` : "AIHOT 精选",
    title: item.title,
    url: item.links?.original || item.links?.aihot || AIHOT_BASE_URL,
    summary: item.summary,
    publishedAt: item.publishedAt ?? item.discoveredAt,
    relevance: score >= 70 ? "强" : "中",
    matchedTerms: ["AIHOT", "精选"],
    heat: score * 10,
    leverageHint: item.reason,
    provider: "aihot",
  };
}

export async function fetchAIHotHotspots(): Promise<{
  items: HotspotItem[];
  hotTopicCount: number;
  selectedCount: number;
}> {
  const [hotTopicsPayload, selectedPayload] = await Promise.all([
    fetchAIHotJson<{ items?: AIHotHotTopic[] }>("/api/v1/hot-topics"),
    fetchAIHotJson<{ items?: AIHotSelectedItem[] }>(
      "/api/v1/items?mode=selected&window=7d&limit=20"
    ),
  ]);

  const hotTopics = (hotTopicsPayload.items ?? []).map(mapHotTopic);
  const selected = (selectedPayload.items ?? []).map(mapSelectedItem);

  const seen = new Set<string>();
  const items: HotspotItem[] = [];
  for (const item of [...hotTopics, ...selected]) {
    const key = item.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }

  return {
    items,
    hotTopicCount: hotTopics.length,
    selectedCount: selected.length,
  };
}
