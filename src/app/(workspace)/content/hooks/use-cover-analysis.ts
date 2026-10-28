"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { requestCoverSuggestions } from "@/lib/api-client";
import {
  clearCoverAnalysisEntry,
  upsertCoverAnalysisEntry,
  type CoverAnalysisEntry,
} from "@/lib/illustrations/cover-analysis-cache";
import type { CoverImageVariant } from "@/lib/illustrations/cover";

interface CoverSource {
  topicId: string;
  title: string;
  digest: string;
  coverCopy: string;
  body: string;
}

function buildCoverSourceKey(input: CoverSource) {
  return [
    input.topicId,
    input.title.trim(),
    input.digest.trim(),
    input.coverCopy.trim(),
    input.body.length,
    input.body.slice(0, 800),
  ].join("|");
}

/** 按选题缓存的封面提示词分析 */
export function useCoverAnalysis(input: CoverSource & { isEvaluation: boolean }) {
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverByTopic, setCoverByTopic] = useState<Record<string, CoverAnalysisEntry>>({});

  const coverSourceKey = useMemo(
    () =>
      buildCoverSourceKey({
        topicId: input.topicId,
        title: input.title,
        digest: input.digest,
        coverCopy: input.coverCopy,
        body: input.body,
      }),
    [input.topicId, input.title, input.digest, input.coverCopy, input.body]
  );

  const coverEntry = coverByTopic[input.topicId];
  const coverVariants = coverEntry?.variants ?? [];
  const coverSummary = coverEntry?.summary;
  const hasCoverCache =
    coverVariants.length > 0 && coverEntry?.cacheKey != null && coverEntry.cacheKey === coverSourceKey;

  const analyzeCover = async (options?: { force?: boolean }): Promise<CoverImageVariant | null> => {
    if (coverLoading) return null;
    if (!input.title.trim() && !input.body.trim()) {
      toast.error("请先填写标题或正文");
      return null;
    }
    if (!options?.force && hasCoverCache) return coverVariants[0] ?? null;
    setCoverLoading(true);
    if (options?.force) {
      setCoverByTopic((current) => clearCoverAnalysisEntry(current, input.topicId));
    }
    try {
      const result = await requestCoverSuggestions({
        title: input.title,
        digest: input.digest,
        coverCopy: input.coverCopy,
        body: input.body,
        topicId: input.topicId,
        isEvaluation: input.isEvaluation,
      });
      const variants = (result.variants ?? []).slice(0, 1);
      setCoverByTopic((current) =>
        upsertCoverAnalysisEntry(current, input.topicId, {
          summary: result.summary,
          variants,
          cacheKey: coverSourceKey,
        })
      );
      return variants[0] ?? null;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "封面图分析失败");
      return null;
    } finally {
      setCoverLoading(false);
    }
  };

  const seedCoverFromGeneration = (
    payload: Omit<CoverSource, "topicId"> & {
      coverSummary?: string;
      coverVariants?: CoverImageVariant[];
    }
  ) => {
    if (!payload.coverVariants?.length) return;
    setCoverByTopic((current) =>
      upsertCoverAnalysisEntry(current, input.topicId, {
        summary: payload.coverSummary,
        variants: payload.coverVariants!.slice(0, 1),
        cacheKey: buildCoverSourceKey({ ...payload, topicId: input.topicId }),
      })
    );
  };

  return { coverLoading, coverSummary, hasCoverCache, analyzeCover, seedCoverFromGeneration };
}
