"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { withLLMPayload } from "@/lib/ai/llm-settings";
import {
  clearCoverAnalysisEntry,
  patchCoverAnalysisVariant,
  upsertCoverAnalysisEntry,
  type CoverAnalysisEntry,
} from "@/lib/illustrations/cover-analysis-cache";
import { CoverImageVariant } from "@/lib/illustrations/cover";
import { IllustrationSuggestion } from "@/lib/illustrations/insert";

function buildCoverSourceKey(input: {
  topicId: string;
  title: string;
  digest: string;
  coverCopy: string;
  body: string;
}) {
  return [
    input.topicId,
    input.title.trim(),
    input.digest.trim(),
    input.coverCopy.trim(),
    input.body.length,
    input.body.slice(0, 800),
  ].join("|");
}

function buildIllustrationSourceKey(input: {
  topicId: string;
  title: string;
  body: string;
}) {
  return [input.topicId, input.title.trim(), input.body.length, input.body.slice(0, 1200)].join(
    "|"
  );
}

export function useContentMedia(input: {
  topicId: string;
  title: string;
  digest: string;
  coverCopy: string;
  body: string;
  isEvaluation: boolean;
  resetInserted: () => void;
}) {
  const [illustrationDialogOpen, setIllustrationDialogOpen] = useState(false);
  const [illustrationLoading, setIllustrationLoading] = useState(false);
  const [illustrationSummary, setIllustrationSummary] = useState<string>();
  const [illustrationSuggestions, setIllustrationSuggestions] = useState<IllustrationSuggestion[]>(
    []
  );
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverByTopic, setCoverByTopic] = useState<Record<string, CoverAnalysisEntry>>({});
  const [illustrationCacheKey, setIllustrationCacheKey] = useState<string | null>(null);

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

  const illustrationSourceKey = useMemo(
    () =>
      buildIllustrationSourceKey({
        topicId: input.topicId,
        title: input.title,
        body: input.body,
      }),
    [input.topicId, input.title, input.body]
  );

  const coverEntry = coverByTopic[input.topicId];
  const coverVariants = coverEntry?.variants ?? [];
  const coverSummary = coverEntry?.summary;
  const coverCacheKey = coverEntry?.cacheKey ?? null;

  const hasCoverCache =
    coverVariants.length > 0 && coverCacheKey !== null && coverCacheKey === coverSourceKey;
  const hasIllustrationCache =
    illustrationSuggestions.length > 0 &&
    illustrationCacheKey !== null &&
    illustrationCacheKey === illustrationSourceKey;

  const resetCoverAnalysis = () => {
    setCoverByTopic((current) => clearCoverAnalysisEntry(current, input.topicId));
  };

  const resetIllustrationAnalysis = () => {
    setIllustrationSuggestions([]);
    setIllustrationSummary(undefined);
    setIllustrationCacheKey(null);
    input.resetInserted();
  };

  const analyzeIllustrations = async (options?: { force?: boolean }) => {
    if (illustrationLoading) return;
    if (!input.body.trim()) {
      toast.error("请先填写正文");
      return;
    }
    const cached =
      !options?.force &&
      illustrationSuggestions.length > 0 &&
      illustrationCacheKey !== null &&
      illustrationCacheKey === illustrationSourceKey;
    if (cached) {
      setIllustrationDialogOpen(true);
      return;
    }
    setIllustrationDialogOpen(true);
    setIllustrationLoading(true);
    if (options?.force) {
      setIllustrationSummary(undefined);
      setIllustrationSuggestions([]);
      input.resetInserted();
    }
    try {
      const res = await fetch("/api/ai/illustrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withLLMPayload({
            title: input.title,
            body: input.body,
            topicId: input.topicId,
            isEvaluation: input.isEvaluation,
          })
        ),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "配图分析失败");
      setIllustrationSummary(result.summary);
      setIllustrationSuggestions(result.suggestions ?? []);
      setIllustrationCacheKey(illustrationSourceKey);
      if (!result.suggestions?.length) {
        toast.message("未找到合适的配图位置");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "配图分析失败");
      setIllustrationDialogOpen(false);
    } finally {
      setIllustrationLoading(false);
    }
  };

  const analyzeCover = async (options?: {
    force?: boolean;
  }): Promise<CoverImageVariant | null> => {
    if (coverLoading) return null;
    if (!input.title.trim() && !input.body.trim()) {
      toast.error("请先填写标题或正文");
      return null;
    }
    const cached =
      !options?.force &&
      coverVariants.length > 0 &&
      coverCacheKey !== null &&
      coverCacheKey === coverSourceKey;
    if (cached) {
      return coverVariants[0] ?? null;
    }
    setCoverLoading(true);
    if (options?.force) {
      setCoverByTopic((current) => clearCoverAnalysisEntry(current, input.topicId));
    }
    try {
      const res = await fetch("/api/ai/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withLLMPayload({
            title: input.title,
            digest: input.digest,
            coverCopy: input.coverCopy,
            body: input.body,
            topicId: input.topicId,
            isEvaluation: input.isEvaluation,
          })
        ),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "封面图分析失败");
      const variants = ((result.variants ?? []) as CoverImageVariant[]).slice(0, 1);
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

  const updateCoverVariant = (id: string, patch: Partial<CoverImageVariant>) => {
    setCoverByTopic((current) =>
      patchCoverAnalysisVariant(current, input.topicId, id, patch)
    );
  };

  const seedFromGeneration = (payload: {
    coverSummary?: string;
    coverVariants?: CoverImageVariant[];
    title: string;
    digest: string;
    coverCopy: string;
    body: string;
  }) => {
    if (!payload.coverVariants?.length) return;
    setCoverByTopic((current) =>
      upsertCoverAnalysisEntry(current, input.topicId, {
        summary: payload.coverSummary,
        variants: (payload.coverVariants ?? []).slice(0, 1),
        cacheKey: buildCoverSourceKey({
          topicId: input.topicId,
          title: payload.title,
          digest: payload.digest,
          coverCopy: payload.coverCopy,
          body: payload.body,
        }),
      })
    );
  };

  return {
    illustrationDialogOpen,
    setIllustrationDialogOpen,
    illustrationLoading,
    illustrationSummary,
    illustrationSuggestions,
    coverLoading,
    coverSummary,
    coverVariants,
    hasCoverCache,
    hasIllustrationCache,
    resetCoverAnalysis,
    resetIllustrationAnalysis,
    analyzeIllustrations,
    analyzeCover,
    updateCoverVariant,
    seedFromGeneration,
  };
}
