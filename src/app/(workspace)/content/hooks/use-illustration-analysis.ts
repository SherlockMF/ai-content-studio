"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { requestIllustrationSuggestions } from "@/lib/api-client";
import type { IllustrationSuggestion } from "@/lib/illustrations/insert";

function buildIllustrationSourceKey(input: { topicId: string; title: string; body: string }) {
  return [input.topicId, input.title.trim(), input.body.length, input.body.slice(0, 1200)].join(
    "|"
  );
}

/** 正文配图位建议（带正文指纹缓存） */
export function useIllustrationAnalysis(input: {
  topicId: string;
  title: string;
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
  const [illustrationCacheKey, setIllustrationCacheKey] = useState<string | null>(null);

  const illustrationSourceKey = useMemo(
    () =>
      buildIllustrationSourceKey({ topicId: input.topicId, title: input.title, body: input.body }),
    [input.topicId, input.title, input.body]
  );
  const hasIllustrationCache =
    illustrationSuggestions.length > 0 &&
    illustrationCacheKey !== null &&
    illustrationCacheKey === illustrationSourceKey;

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
    setIllustrationDialogOpen(true);
    if (!options?.force && hasIllustrationCache) return;
    setIllustrationLoading(true);
    if (options?.force) {
      setIllustrationSummary(undefined);
      setIllustrationSuggestions([]);
      input.resetInserted();
    }
    try {
      const result = await requestIllustrationSuggestions({
        title: input.title,
        body: input.body,
        topicId: input.topicId,
        isEvaluation: input.isEvaluation,
      });
      setIllustrationSummary(result.summary);
      setIllustrationSuggestions(result.suggestions ?? []);
      setIllustrationCacheKey(illustrationSourceKey);
      if (!result.suggestions?.length) toast.message("未找到合适的配图位置");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "配图分析失败");
      setIllustrationDialogOpen(false);
    } finally {
      setIllustrationLoading(false);
    }
  };

  return {
    illustrationDialogOpen,
    setIllustrationDialogOpen,
    illustrationLoading,
    illustrationSummary,
    illustrationSuggestions,
    hasIllustrationCache,
    resetIllustrationAnalysis,
    analyzeIllustrations,
  };
}
