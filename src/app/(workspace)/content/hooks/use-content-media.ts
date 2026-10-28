"use client";

import type { ContentItem } from "@/types/domain";
import { useCoverAnalysis } from "./use-cover-analysis";
import { useIllustrationAnalysis } from "./use-illustration-analysis";

export function useContentMedia(input: {
  topicId: string;
  title: string;
  digest: string;
  coverCopy: string;
  body: string;
  isEvaluation: boolean;
  resetInserted: () => void;
}) {
  const cover = useCoverAnalysis(input);
  const illustrations = useIllustrationAnalysis(input);

  /** 稿件自带封面方案时，写入封面缓存，避免重复分析 */
  const seedFromContent = (content: ContentItem) => {
    const pack = content.coverPromptPack;
    if (!pack?.variants?.length) return;
    cover.seedCoverFromGeneration({
      coverSummary: pack.summary,
      coverVariants: pack.variants,
      title: content.title,
      digest: content.digest ?? "",
      coverCopy: content.coverCopy ?? "",
      body: content.body,
    });
  };

  return { ...cover, ...illustrations, seedFromContent };
}

export type ContentMedia = ReturnType<typeof useContentMedia>;
