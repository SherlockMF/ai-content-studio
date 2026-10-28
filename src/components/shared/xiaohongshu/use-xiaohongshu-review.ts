"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { buildXiaohongshuReviewSignature } from "@/lib/ai/xiaohongshu-prompt";
import { requestXiaohongshuReview } from "@/lib/api-client";
import { hasText } from "@/lib/has-text";
import { createId } from "@/lib/ids";
import type { ContentItem, ContentReview, XiaohongshuTone } from "@/types/domain";
import type { XiaohongshuDraftSession } from "./use-xiaohongshu-draft";

export interface XiaohongshuReviewBinding {
  platform: "xiaohongshu";
  tone: XiaohongshuTone;
  signature: string;
}

type BoundXiaohongshuReview = ContentReview & {
  xiaohongshuSnapshot?: XiaohongshuReviewBinding;
};

export function buildReviewBinding(sourceBody: string, draft: ContentItem): XiaohongshuReviewBinding | null {
  const data = draft.xiaohongshu;
  if (!data) return null;
  const tone = data.activeTone;
  return {
    platform: "xiaohongshu",
    tone,
    signature: buildXiaohongshuReviewSignature({
      sourceBody,
      tone,
      variant: data.variants[tone],
      visualDirection: data.visualDirection,
      imagePlan: data.imagePlan,
    }),
  };
}

export function matchingReview(
  review: ContentReview | undefined,
  binding: XiaohongshuReviewBinding
): ContentReview | undefined {
  const saved = (review as BoundXiaohongshuReview | undefined)?.xiaohongshuSnapshot;
  return saved?.platform === binding.platform &&
    saved.tone === binding.tone &&
    saved.signature === binding.signature
    ? review
    : undefined;
}

export function useXiaohongshuReview(input: {
  session: XiaohongshuDraftSession;
  targetAudience: string;
  onReviewSaved: (review: ContentReview) => void;
}) {
  const { draftRef, sourceContentRef, mountedRef, conversionInFlightRef } = input.session;
  const [reviewing, setReviewing] = useState(false);
  const requestIdRef = useRef(0);

  const cancelReview = () => {
    requestIdRef.current += 1;
    setReviewing(false);
  };

  const runReview = async () => {
    const source = sourceContentRef.current;
    const requestedDraft = draftRef.current;
    if (!source || !hasText(source.body)) {
      toast.error("来源公众号正文不可用，暂时无法核对事实");
      return;
    }
    if (!requestedDraft?.xiaohongshu || conversionInFlightRef.current) return;
    const data = requestedDraft.xiaohongshu;
    const requestedVariant = data.variants[data.activeTone];
    const requestedBinding = buildReviewBinding(source.body, requestedDraft)!;
    const requestId = ++requestIdRef.current;
    setReviewing(true);
    try {
      const result = await requestXiaohongshuReview({
        sourceBody: source.body,
        title: requestedVariant.title,
        body: requestedVariant.body,
        cta: requestedVariant.cta,
        hashtags: requestedVariant.hashtags,
        visualDirection: data.visualDirection,
        imagePlan: data.imagePlan,
        targetAudience: input.targetAudience,
      });
      const currentDraft = draftRef.current;
      if (!mountedRef.current || requestId !== requestIdRef.current || !currentDraft?.xiaohongshu) {
        return;
      }
      const currentBinding = buildReviewBinding(sourceContentRef.current?.body ?? "", currentDraft);
      if (
        currentBinding?.tone !== requestedBinding.tone ||
        currentBinding.signature !== requestedBinding.signature
      ) {
        toast.message("稿件已更新，本次质检结果未保存");
        return;
      }
      const review: BoundXiaohongshuReview = {
        id: createId("review"),
        contentItemId: requestedDraft.id,
        ...result,
        createdAt: new Date().toISOString(),
        xiaohongshuSnapshot: requestedBinding,
      };
      input.onReviewSaved(review);
      toast.success(`质检完成，得分 ${review.score}`);
    } catch (error) {
      if (mountedRef.current && requestId === requestIdRef.current) {
        toast.error(error instanceof Error ? error.message : "质检失败");
      }
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setReviewing(false);
      }
    }
  };

  return { reviewing, runReview, cancelReview };
}
