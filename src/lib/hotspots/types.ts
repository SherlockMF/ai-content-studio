export type HotspotRelevance = "强" | "中" | "弱";

export interface HotspotFeedEntry {
  title: string;
  url: string;
  summary?: string;
  publishedAt?: string;
}

export interface HotspotSourceConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
}

export interface HotspotItem {
  id: string;
  sourceId: string;
  sourceName: string;
  title: string;
  url: string;
  summary?: string;
  publishedAt?: string;
  relevance: HotspotRelevance;
  matchedTerms: string[];
  heat: number;
  /** AIHOT 等平台提供的蹭热点角度 / 推荐理由 */
  leverageHint?: string;
  provider?: "rss" | "aihot";
}

export interface HotspotSnapshot {
  id: string;
  fetchedAt: string;
  expiresAt: string;
  items: HotspotItem[];
  sourceReports: Array<{
    sourceId: string;
    sourceName: string;
    status: "ok" | "failed";
    itemCount: number;
    message?: string;
  }>;
}

export const HOTSPOT_CACHE_TTL_MS = 8 * 60 * 60 * 1000;
export const HOTSPOT_FETCH_TIMEOUT_MS = 12_000;
export const HOTSPOT_MAX_ITEMS = 60;
