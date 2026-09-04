import type { CoverImageVariant } from "@/lib/illustrations/cover";

export type CoverAnalysisEntry = {
  summary?: string;
  variants: CoverImageVariant[];
  cacheKey: string;
};

export function upsertCoverAnalysisEntry(
  cache: Record<string, CoverAnalysisEntry>,
  topicId: string,
  entry: CoverAnalysisEntry
): Record<string, CoverAnalysisEntry> {
  return { ...cache, [topicId]: entry };
}

export function patchCoverAnalysisVariant(
  cache: Record<string, CoverAnalysisEntry>,
  topicId: string,
  variantId: string,
  patch: Partial<CoverImageVariant>
): Record<string, CoverAnalysisEntry> {
  const current = cache[topicId];
  if (!current) return cache;
  return {
    ...cache,
    [topicId]: {
      ...current,
      variants: current.variants.map((item) =>
        item.id === variantId ? { ...item, ...patch } : item
      ),
    },
  };
}

export function clearCoverAnalysisEntry(
  cache: Record<string, CoverAnalysisEntry>,
  topicId: string
): Record<string, CoverAnalysisEntry> {
  if (!(topicId in cache)) return cache;
  const next = { ...cache };
  delete next[topicId];
  return next;
}
