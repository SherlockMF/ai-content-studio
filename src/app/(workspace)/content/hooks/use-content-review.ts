"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { requestWechatReview } from "@/lib/api-client";
import { createId } from "@/lib/ids";
import { reviewRevisionSignature, type ReviewRevisionDraft } from "@/lib/review-revision";
import type { ContentItem, ContentReview, Topic } from "@/types/domain";
import type { DraftSnapshot, WechatDraft } from "./use-wechat-draft";

function latestReviewFor(reviews: ContentReview[], contentId: string | undefined) {
  if (!contentId) return undefined;
  return [...reviews]
    .filter((review) => review.contentItemId === contentId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function snapshotSignature(draft: DraftSnapshot) {
  return reviewRevisionSignature(
    {
      platform: "wechat",
      title: draft.title,
      body: draft.body,
      digest: draft.digest,
      coverCopy: draft.coverCopy,
      cta: draft.cta,
    },
    "",
    draft.supplementaryNotes
  );
}

export function useContentReview(input: {
  draft: WechatDraft;
  persistDraft: WechatDraft["persistDraft"];
  selectedTopic: Topic | undefined;
  activeTopicId: string;
  activeContent: ContentItem | undefined;
  xiaohongshuContentId: string | undefined;
  reviews: ContentReview[];
  addReview: (review: ContentReview) => void;
  targetAudience: string;
}) {
  const { draft, reviews, activeContent } = input;
  const { fields } = draft;
  const [reviewLoading, setReviewLoading] = useState(false);

  const latestReviewRecord = useMemo(
    () => latestReviewFor(reviews, activeContent?.id),
    [reviews, activeContent]
  );
  const latestXiaohongshuReview = useMemo(
    () => latestReviewFor(reviews, input.xiaohongshuContentId),
    [reviews, input.xiaohongshuContentId]
  );
  const revisionDraft: ReviewRevisionDraft = {
    platform: "wechat",
    title: fields.title,
    body: fields.body,
    digest: fields.digest,
    coverCopy: fields.coverCopy,
    cta: fields.cta,
  };
  const reviewSignature = reviewRevisionSignature(revisionDraft, "", fields.supplementaryNotes);
  const latestReview =
    latestReviewRecord?.contentSnapshot === reviewSignature ? latestReviewRecord : undefined;

  const runReview = async (options?: { manageLoading?: boolean }) => {
    const start = draft.draftRef.current;
    if (!start.body.trim()) {
      toast.error("请先填写正文");
      return;
    }
    if (!input.selectedTopic) {
      toast.error("请先选择选题");
      return;
    }

    let contentId = activeContent?.id ?? start.contentId;
    if (!contentId) {
      const saved = input.persistDraft(
        {
          id: createId("content"),
          topicId: input.activeTopicId,
          source: fields.source,
          status: fields.status,
        },
        "user_edit"
      );
      contentId = saved.id;
    }

    const startSignature = snapshotSignature(start);
    const manageLoading = options?.manageLoading !== false;
    if (manageLoading) setReviewLoading(true);
    try {
      const { issues, score } = await requestWechatReview({
        title: start.title,
        body: start.body,
        targetAudience: input.targetAudience,
        supplementaryNotes: start.supplementaryNotes.trim() || undefined,
      });
      const current = draft.draftRef.current;
      if (current.topicId !== input.activeTopicId || snapshotSignature(current) !== startSignature) {
        toast.message("稿件已变化，本次质检结果未应用，请重新质检");
        return;
      }
      input.addReview({
        id: createId("review"),
        contentItemId: contentId,
        contentSnapshot: startSignature,
        score,
        issues,
        createdAt: new Date().toISOString(),
      });
      toast.success(`质检完成，得分 ${score}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "质检失败");
    } finally {
      if (manageLoading) setReviewLoading(false);
    }
  };

  return {
    reviewLoading,
    runReview,
    latestReviewRecord,
    latestReview,
    latestXiaohongshuReview,
    revisionDraft,
  };
}
