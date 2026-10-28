"use client";

import { toast } from "sonner";
import { ReviewIssuesPanel } from "@/components/shared/review-issues-panel";
import { XiaohongshuPublishPanel } from "@/components/shared/xiaohongshu-publish-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requiresPublishChecks, shouldStampPublishedAt } from "@/lib/content-status";
import { hasText } from "@/lib/has-text";
import type { ReviewRevisionDraft } from "@/lib/review-revision";
import { saveXiaohongshuVariant } from "@/lib/xiaohongshu/content";
import { buildXiaohongshuPublishChecks } from "@/lib/xiaohongshu/publish";
import type {
  ContentItem,
  ContentReview,
  ContentStatus,
  PublishVoice,
  XiaohongshuTone,
  XiaohongshuVariant,
} from "@/types/domain";
import { useXiaohongshuConversion } from "./xiaohongshu/use-xiaohongshu-conversion";
import { useXiaohongshuDraft } from "./xiaohongshu/use-xiaohongshu-draft";
import { useXiaohongshuImages } from "./xiaohongshu/use-xiaohongshu-images";
import {
  buildReviewBinding,
  matchingReview,
  useXiaohongshuReview,
} from "./xiaohongshu/use-xiaohongshu-review";
import { XiaohongshuVariantForm } from "./xiaohongshu/xiaohongshu-variant-form";

export interface XiaohongshuEditorProps {
  sourceContent: ContentItem | null;
  content: ContentItem | null;
  latestReview?: ContentReview;
  publishVoice: PublishVoice;
  conversionRequestId: number;
  onSave: (
    content: ContentItem,
    source: "ai_generate" | "user_edit" | "ai_rewrite"
  ) => void;
  onReviewSaved: (review: ContentReview) => void;
  onBackToWechat: () => void;
  onConversionSuccess?: () => void;
  onConversionSettled?: (success: boolean) => void;
}

export function XiaohongshuEditor({
  sourceContent,
  content,
  latestReview,
  publishVoice,
  conversionRequestId,
  onSave,
  onReviewSaved,
  onBackToWechat,
  onConversionSuccess,
  onConversionSettled,
}: XiaohongshuEditorProps) {
  const session = useXiaohongshuDraft({ content, sourceContent, onSave });
  const images = useXiaohongshuImages({ session, publishVoice, onSave });
  const review = useXiaohongshuReview({
    session,
    targetAudience: publishVoice.audience,
    onReviewSaved,
  });
  const { converting, convertFull } = useXiaohongshuConversion({
    session,
    sourceContent,
    publishVoice,
    isImageJobRunning: images.isImageJobRunning,
    cancelPending: () => {
      images.cancelImageRequests();
      review.cancelReview();
    },
    renderImages: images.renderImages,
    onSave,
    conversionRequestId,
    onConversionSuccess,
    onConversionSettled,
  });
  const { draft, draftRef, commitDraft, updateDraft } = session;

  if (!draft?.xiaohongshu) {
    return (
      <Card className="border-rose-200/80 bg-rose-50/30">
        <CardHeader>
          <CardTitle className="text-base">暂无小红书稿件</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">
            将当前公众号长文改编为专业轻表达和强氛围两版文案，并自动规划配图提示词、调用生图模型生成图片。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={converting || !hasText(sourceContent?.body)}
              onClick={() => void convertFull(false)}
            >
              {converting ? "转换中…" : "一键转小红书"}
            </Button>
            <Button variant="outline" onClick={onBackToWechat}>
              返回公众号
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const data = draft.xiaohongshu;
  const tone = data.activeTone;
  const variant = data.variants[tone];
  const currentReview = matchingReview(latestReview, buildReviewBinding(sourceContent?.body ?? "", draft)!);

  const updateVariant = (patch: Partial<XiaohongshuVariant>) =>
    updateDraft((current) => {
      const activeTone = current.xiaohongshu!.activeTone;
      return saveXiaohongshuVariant(
        current,
        activeTone,
        { ...current.xiaohongshu!.variants[activeTone], ...patch },
        new Date().toISOString()
      );
    });

  const selectTone = (nextTone: XiaohongshuTone) =>
    updateDraft((current) =>
      saveXiaohongshuVariant(current, nextTone, current.xiaohongshu!.variants[nextTone], new Date().toISOString())
    );

  const updateStatus = (target: ContentStatus) => {
    const blocking = buildXiaohongshuPublishChecks({ data, tone, review: currentReview }).some(
      (check) => check.blocking && !check.ok
    );
    if (requiresPublishChecks(target) && blocking) {
      toast.error("发布检查未通过，不能标记为待发布/已发布");
      return;
    }
    commitDraft(
      {
        ...draft,
        status: target,
        publishedAt: shouldStampPublishedAt(target)
          ? draft.publishedAt ?? new Date().toISOString()
          : draft.publishedAt,
        updatedAt: new Date().toISOString(),
      },
      "user_edit"
    );
    toast.success(`状态已更新为 ${target}`);
  };

  const applyRevision = (revised: ReviewRevisionDraft) => {
    const current = draftRef.current;
    if (!current?.xiaohongshu || revised.platform !== "xiaohongshu") return;
    const next = saveXiaohongshuVariant(
      current,
      tone,
      { ...current.xiaohongshu.variants[tone], title: revised.title, body: revised.body },
      new Date().toISOString()
    );
    if (!next.xiaohongshu) return;
    next.xiaohongshu.imagePlan = revised.imagePlan ?? next.xiaohongshu.imagePlan;
    next.xiaohongshu.visualDirection = revised.visualDirection ?? next.xiaohongshu.visualDirection;
    next.coverCopy = next.xiaohongshu.imagePlan[0]?.overlayText ?? next.coverCopy;
    next.status = "编辑中";
    commitDraft(next, "ai_rewrite");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">小红书稿件</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              来源：{sourceContent?.title?.trim() || "来源稿件不可用"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{draft.status}</Badge>
            <Button variant="outline" size="sm" onClick={onBackToWechat}>
              查看公众号原稿
            </Button>
            <Button variant="outline" size="sm" disabled={converting} onClick={() => void convertFull(true)}>
              {converting ? "转换中…" : "重新转换全文"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <XiaohongshuVariantForm
        tone={tone}
        variant={variant}
        status={draft.status}
        reviewing={review.reviewing}
        onToneChange={selectTone}
        onStatusChange={updateStatus}
        onVariantChange={updateVariant}
        onSave={() => {
          onSave(draft, "user_edit");
          toast.success("小红书稿件已保存");
        }}
        onReview={() => void review.runReview()}
      />

      <XiaohongshuPublishPanel
        data={data}
        tone={tone}
        sourceTitle={sourceContent?.title}
        review={currentReview}
        onReplanImagePrompts={images.replanImagePrompts}
        onGenerateImages={images.generateRenderedImages}
        onImportLocalImages={images.importLocalImages}
        imageRegenerating={images.imageRegenerating}
        imageRendering={images.imageRendering}
        imageProgress={images.imageProgress}
      />

      {latestReview ? (
        <ReviewIssuesPanel
          key={`${latestReview.id}-${tone}`}
          review={latestReview}
          draft={{
            platform: "xiaohongshu",
            title: variant.title,
            body: variant.body,
            visualDirection: data.visualDirection,
            imagePlan: data.imagePlan,
          }}
          sourceBody={sourceContent?.body}
          supplementaryNotes={sourceContent?.supplementaryNotes}
          targetAudience={publishVoice.audience}
          stale={!currentReview}
          disabled={review.reviewing || converting || images.imageRegenerating || images.imageRendering}
          onApply={applyRevision}
        />
      ) : null}
    </div>
  );
}
