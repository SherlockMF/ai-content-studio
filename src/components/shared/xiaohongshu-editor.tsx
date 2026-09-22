"use client";

import { useAppStore } from "@/lib/store/app-store";
import { imagePlanSignature } from "@/lib/xiaohongshu/merge-generated-image";
import { ReviewIssuesPanel } from "@/components/shared/review-issues-panel";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { XiaohongshuPublishPanel } from "@/components/shared/xiaohongshu-publish-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { withLLMPayload } from "@/lib/ai/llm-settings";
import { xiaohongshuOutputSchema } from "@/lib/ai/schemas";
import {
  XIAOHONGSHU_FIXED_VISUAL_DIRECTION,
  buildXiaohongshuReviewSignature,
} from "@/lib/ai/xiaohongshu-prompt";
import { CONTENT_STATUSES, requiresPublishChecks, shouldStampPublishedAt } from "@/lib/content-status";
import { hasText } from "@/lib/has-text";
import { createXiaohongshuContent, normalizeXiaohongshuContent, saveXiaohongshuVariant } from "@/lib/xiaohongshu/content";
import {
  countMissingXiaohongshuImages,
} from "@/lib/xiaohongshu/generate-images";
import { mergeImportedUrlsIntoImagePlan } from "@/lib/xiaohongshu/import-local-images-shared";
import {
  XIAOHONGSHU_BODY_MAX_CHARS,
  XIAOHONGSHU_TITLE_MAX_CHARS,
  clampXiaohongshuBody,
  clampXiaohongshuTitle,
  countXiaohongshuChars,
} from "@/lib/xiaohongshu/limits";
import { extractHashtagsFromText } from "@/lib/xiaohongshu/note-body";
import { buildXiaohongshuPublishChecks } from "@/lib/xiaohongshu/publish";
import type {
  ContentItem,
  ContentReview,
  ContentStatus,
  PublishVoice,
  XiaohongshuGenerationResult,
  XiaohongshuImagePrompt,
  XiaohongshuTone,
  XiaohongshuVariant,
} from "@/types/domain";

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

function sourceSignature(content: ContentItem | null): string {
  if (!content) return "";
  return JSON.stringify({
    id: content.id,
    title: content.title,
    digest: content.digest,
    body: content.body,
    cta: content.cta,
    supplementaryNotes: content.supplementaryNotes,
  });
}

interface XiaohongshuReviewBinding {
  platform: "xiaohongshu";
  tone: XiaohongshuTone;
  signature: string;
}

type BoundXiaohongshuReview = ContentReview & {
  xiaohongshuSnapshot?: XiaohongshuReviewBinding;
};

function matchingReview(
  review: ContentReview | undefined,
  binding: XiaohongshuReviewBinding
): ContentReview | undefined {
  const savedBinding = (review as BoundXiaohongshuReview | undefined)?.xiaohongshuSnapshot;
  return savedBinding?.platform === binding.platform &&
    savedBinding.tone === binding.tone &&
    savedBinding.signature === binding.signature
    ? review
    : undefined;
}

async function requestConversion(sourceContent: ContentItem, publishVoice: PublishVoice) {
  const response = await fetch("/api/ai/xiaohongshu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      withLLMPayload({
        sourceContent: {
          id: sourceContent.id,
          title: sourceContent.title,
          digest: sourceContent.digest,
          body: sourceContent.body,
          cta: sourceContent.cta,
          supplementaryNotes: sourceContent.supplementaryNotes,
        },
        voice: publishVoice,
      })
    ),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.message === "string" ? payload.message : "小红书转换失败"
    );
  }
  return xiaohongshuOutputSchema.parse(payload);
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
  const [draft, setDraft] = useState<ContentItem | null>(content);
  const [converting, setConverting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [imageRegenerating, setImageRegenerating] = useState(false);
  const { imageJobs, generateXiaohongshuImages } = useAppStore();
  const [imageImporting, setImageRendering] = useState(false);
  const job = imageJobs[draft?.id ?? ""];
  const imageRendering = imageImporting || Boolean(job?.running);
  const previousImageRunning = useRef(false);
  const [imageProgress, setImageProgress] = useState("");
  const handledRequestIdRef = useRef(0);
  const conversionInFlightRef = useRef(false);
  const imageRenderInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const draftRef = useRef<ContentItem | null>(draft);
  const sourceContentRef = useRef<ContentItem | null>(sourceContent);
  const imageRequestIdRef = useRef(0);
  const imageRenderRequestIdRef = useRef(0);
  const reviewRequestIdRef = useRef(0);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    sourceContentRef.current = sourceContent;
  }, [sourceContent]);

  // 本地草稿与 store 同步：hydration / 外部保存后能重新显示已有小红书稿
  useEffect(() => {
    if (conversionInFlightRef.current) return;
    if (!content?.xiaohongshu) return;
    const current = draftRef.current;
    if (
      current?.id === content.id &&
      current.updatedAt === content.updatedAt &&
      current.xiaohongshu
    ) {
      return;
    }
    let normalized = normalizeXiaohongshuContent(content);
    if (current?.id === content.id && current.xiaohongshu && normalized.xiaohongshu && (job?.running || previousImageRunning.current)) {
      const incoming = normalized.xiaohongshu.imagePlan;
      normalized = { ...current, updatedAt: content.updatedAt, xiaohongshu: { ...current.xiaohongshu,
        imagePlan: current.xiaohongshu.imagePlan.map(image => {
          const next = incoming.find(candidate => candidate.index === image.index && imagePlanSignature(candidate) === imagePlanSignature(image));
          return next ? { ...image, imageUrl: next.imageUrl, imageError: next.imageError } : image;
        }),
      } };
    }
    draftRef.current = normalized;
    setDraft(normalized);
  }, [content, job?.running]);

  useEffect(() => { previousImageRunning.current = Boolean(job?.running); }, [job?.running]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const applyImagePlan = useCallback(
    (contentItem: ContentItem, imagePlan: XiaohongshuImagePrompt[]) => {
      if (!contentItem.xiaohongshu) return contentItem;
      const now = new Date().toISOString();
      const next: ContentItem = {
        ...contentItem,
        coverCopy: imagePlan[0]?.overlayText ?? contentItem.coverCopy,
        xiaohongshu: {
          ...contentItem.xiaohongshu,
          visualDirection:
            contentItem.xiaohongshu.visualDirection || XIAOHONGSHU_FIXED_VISUAL_DIRECTION,
          imagePlan,
        },
        updatedAt: now,
      };
      draftRef.current = next;
      setDraft(next);
      onSave(next, "ai_rewrite");
      return next;
    },
    [onSave]
  );

  const renderImagesForDraft = useCallback(
    async (contentItem: ContentItem, options: { onlyMissing: boolean; successToast: string }) => {
      if (!contentItem.xiaohongshu) return;
      await generateXiaohongshuImages(contentItem, options.onlyMissing);
    }, [generateXiaohongshuImages]
  );

  const convertFull = useCallback(
    async (confirmOverwrite: boolean) => {
      if (conversionInFlightRef.current) return false;
      if (imageJobs[draftRef.current?.id ?? ""]?.running) {
        toast.message("该稿件正在后台生图，请完成后再重新转换");
        return false;
      }
      if (!sourceContent || !hasText(sourceContent.body)) {
        toast.error("请先填写公众号正文");
        return false;
      }
      const source = sourceContent;
      const currentDraft = draftRef.current;
      const hasExistingDraft = Boolean(currentDraft?.xiaohongshu);
      if (
        confirmOverwrite &&
        hasExistingDraft &&
        !window.confirm("重新转换会覆盖当前两版文案和图片规划，确定继续？")
      ) {
        return false;
      }

      if (hasExistingDraft && currentDraft) {
        onSave(currentDraft, "user_edit");
      }

      const requestedSourceSignature = sourceSignature(source);
      imageRequestIdRef.current += 1;
      imageRenderRequestIdRef.current += 1;
      reviewRequestIdRef.current += 1;
      setImageRegenerating(false);
      setImageRendering(false);
      setImageProgress("");
      setReviewing(false);
      conversionInFlightRef.current = true;
      setConverting(true);
      try {
        const result: XiaohongshuGenerationResult = await requestConversion(
          source,
          publishVoice
        );
        if (
          !mountedRef.current ||
          sourceSignature(sourceContentRef.current) !== requestedSourceSignature
        ) {
          return false;
        }
        const next = createXiaohongshuContent({
          source,
          result,
          now: new Date().toISOString(),
          existing: currentDraft ?? undefined,
        });
        draftRef.current = next;
        setDraft(next);
        onSave(next, hasExistingDraft ? "ai_rewrite" : "ai_generate");
        onConversionSuccess?.();
        toast.success(
          hasExistingDraft
            ? "文案已更新，开始生成配图…"
            : "文案已生成，开始生成配图…"
        );

        conversionInFlightRef.current = false;
        setConverting(false);
        void renderImagesForDraft(next, {
          onlyMissing: false,
          successToast: "小红书配图已生成",
        });
        return true;
      } catch (error) {
        if (mountedRef.current) {
          toast.error(error instanceof Error ? error.message : "小红书转换失败");
        }
        return false;
      } finally {
        conversionInFlightRef.current = false;
        if (mountedRef.current) setConverting(false);
      }
    },
    [onConversionSuccess, onSave, publishVoice, renderImagesForDraft, sourceContent, imageJobs]
  );

  useEffect(() => {
    if (
      conversionRequestId <= 0 ||
      conversionRequestId === handledRequestIdRef.current
    ) {
      return;
    }
    handledRequestIdRef.current = conversionRequestId;
    void convertFull(true).then((success) => {
      if (mountedRef.current) onConversionSettled?.(success);
    });
  }, [conversionRequestId, convertFull, onConversionSettled]);

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
  const reviewBinding: XiaohongshuReviewBinding = {
    platform: "xiaohongshu",
    tone,
    signature: buildXiaohongshuReviewSignature({
      sourceBody: sourceContent?.body ?? "",
      tone,
      variant,
      visualDirection: data.visualDirection,
      imagePlan: data.imagePlan,
    }),
  };
  const currentReview = matchingReview(latestReview, reviewBinding);

  const updateVariant = (patch: Partial<XiaohongshuVariant>) => {
    setDraft((current) => {
      if (!current?.xiaohongshu) return current;
      const currentVariant = current.xiaohongshu.variants[current.xiaohongshu.activeTone];
      const next = saveXiaohongshuVariant(
        current,
        current.xiaohongshu.activeTone,
        { ...currentVariant, ...patch },
        new Date().toISOString()
      );
      draftRef.current = next;
      return next;
    });
  };

  const selectTone = (nextTone: XiaohongshuTone) => {
    setDraft((current) => {
      if (!current?.xiaohongshu) return current;
      const next = saveXiaohongshuVariant(
        current,
        nextTone,
        current.xiaohongshu.variants[nextTone],
        new Date().toISOString()
      );
      draftRef.current = next;
      return next;
    });
  };

  const saveDraft = () => {
    if (!draft) return;
    onSave(draft, "user_edit");
    toast.success("小红书稿件已保存");
  };

  const updateStatus = (target: ContentStatus) => {
    if (!draft) return;
    const blocking = buildXiaohongshuPublishChecks({
      data,
      tone,
      review: currentReview,
    }).some((check) => check.blocking && !check.ok);
    if (requiresPublishChecks(target) && blocking) {
      toast.error("发布检查未通过，不能标记为待发布/已发布");
      return;
    }
    const next: ContentItem = {
      ...draft,
      status: target,
      publishedAt: shouldStampPublishedAt(target)
        ? draft.publishedAt ?? new Date().toISOString()
        : draft.publishedAt,
      updatedAt: new Date().toISOString(),
    };
    draftRef.current = next;
    setDraft(next);
    onSave(next, "user_edit");
    toast.success(`状态已更新为 ${target}`);
  };

  const runReview = async () => {
    const requestedSource = sourceContentRef.current;
    const requestedDraft = draftRef.current;
    if (!requestedSource || !hasText(requestedSource.body)) {
      toast.error("来源公众号正文不可用，暂时无法核对事实");
      return;
    }
    if (!requestedDraft?.xiaohongshu || conversionInFlightRef.current) return;
    const source = requestedSource;
    const requestedTone = requestedDraft.xiaohongshu.activeTone;
    const requestedVariant = requestedDraft.xiaohongshu.variants[requestedTone];
    const requestedBinding: XiaohongshuReviewBinding = {
      platform: "xiaohongshu",
      tone: requestedTone,
      signature: buildXiaohongshuReviewSignature({
        sourceBody: source.body,
        tone: requestedTone,
        variant: requestedVariant,
        visualDirection: requestedDraft.xiaohongshu.visualDirection,
        imagePlan: requestedDraft.xiaohongshu.imagePlan,
      }),
    };
    const requestId = ++reviewRequestIdRef.current;
    setReviewing(true);
    try {
      const response = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withLLMPayload({
            platform: "xiaohongshu",
            sourceBody: source.body,
            title: requestedVariant.title,
            body: requestedVariant.body,
            cta: requestedVariant.cta,
            hashtags: requestedVariant.hashtags,
            visualDirection: requestedDraft.xiaohongshu.visualDirection,
            imagePlan: requestedDraft.xiaohongshu.imagePlan,
            targetAudience: publishVoice.audience,
          })
        ),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.message === "string" ? payload.message : "质检失败");
      }
      const currentDraft = draftRef.current;
      if (
        !mountedRef.current ||
        requestId !== reviewRequestIdRef.current ||
        !currentDraft?.xiaohongshu
      ) {
        return;
      }
      const currentTone = currentDraft.xiaohongshu.activeTone;
      const currentSignature = buildXiaohongshuReviewSignature({
        sourceBody: sourceContentRef.current?.body ?? "",
        tone: currentTone,
        variant: currentDraft.xiaohongshu.variants[currentTone],
        visualDirection: currentDraft.xiaohongshu.visualDirection,
        imagePlan: currentDraft.xiaohongshu.imagePlan,
      });
      if (
        currentTone !== requestedBinding.tone ||
        currentSignature !== requestedBinding.signature
      ) {
        toast.message("稿件已更新，本次质检结果未保存");
        return;
      }
      const review: BoundXiaohongshuReview = {
        id: `review_${Date.now()}`,
        contentItemId: requestedDraft.id,
        score: typeof payload.score === "number" ? payload.score : 0,
        issues: Array.isArray(payload.issues) ? payload.issues : [],
        createdAt: new Date().toISOString(),
        xiaohongshuSnapshot: requestedBinding,
      };
      onReviewSaved(review);
      toast.success(`质检完成，得分 ${review.score}`);
    } catch (error) {
      if (mountedRef.current && requestId === reviewRequestIdRef.current) {
        toast.error(error instanceof Error ? error.message : "质检失败");
      }
    } finally {
      if (mountedRef.current && requestId === reviewRequestIdRef.current) {
        setReviewing(false);
      }
    }
  };

  const replanImagePrompts = async () => {
    if (conversionInFlightRef.current) {
      throw new Error("全文转换进行中，请稍后再规划图片");
    }
    const requestedSource = sourceContentRef.current;
    if (!requestedSource || !hasText(requestedSource.body)) {
      throw new Error("来源公众号正文不可用，无法重新规划图片");
    }
    const source = requestedSource;
    const requestedSourceSignature = sourceSignature(source);
    const requestId = ++imageRequestIdRef.current;
    setImageRegenerating(true);
    try {
      const result = await requestConversion(source, publishVoice);
      if (
        !mountedRef.current ||
        requestId !== imageRequestIdRef.current ||
        sourceSignature(sourceContentRef.current) !== requestedSourceSignature
      ) {
        return;
      }
      const currentDraft = draftRef.current;
      if (!currentDraft?.xiaohongshu) return;
      const now = new Date().toISOString();
      const next: ContentItem = {
        ...currentDraft,
        coverCopy: result.imagePlan[0]?.overlayText,
        xiaohongshu: {
          ...currentDraft.xiaohongshu,
          visualDirection: result.visualDirection || XIAOHONGSHU_FIXED_VISUAL_DIRECTION,
          imagePlan: result.imagePlan,
        },
        updatedAt: now,
      };
      draftRef.current = next;
      setDraft(next);
      onSave(next, "ai_rewrite");
      toast.success("图片提示词已更新，开始生成配图…");
      await renderImagesForDraft(next, {
        onlyMissing: false,
        successToast: "小红书配图已生成",
      });
    } finally {
      if (mountedRef.current && requestId === imageRequestIdRef.current) {
        setImageRegenerating(false);
      }
    }
  };

  const generateRenderedImages = async (onlyMissing: boolean) => {
    const currentDraft = draftRef.current;
    if (!currentDraft?.xiaohongshu) {
      throw new Error("暂无小红书图片规划");
    }
    if (imageJobs[currentDraft.id]?.running) return;
    onSave(currentDraft, "user_edit");
    await renderImagesForDraft(currentDraft, {
      onlyMissing,
      successToast: onlyMissing ? "缺失配图已补全" : "小红书配图已重新生成",
    });
  };

  const importLocalImages = async () => {
    const currentDraft = draftRef.current;
    if (!currentDraft?.xiaohongshu) {
      throw new Error("暂无小红书图片规划");
    }
    if (imageRendering || imageRenderInFlightRef.current || conversionInFlightRef.current) {
      throw new Error("请等待当前转换/生图完成后再导入");
    }
    const requestId = ++imageRenderRequestIdRef.current;
    imageRenderInFlightRef.current = true;
    setImageRendering(true);
    setImageProgress("正在导入本地配图…");
    try {
      const response = await fetch("/api/xiaohongshu/import-local-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: currentDraft.title,
          body: currentDraft.body,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        folder?: string;
        images?: Array<{ index: number; role: string; url: string; fileName: string }>;
        message?: string;
      };
      if (!response.ok || !payload.images?.length) {
        throw new Error(payload.message || "导入本地配图失败");
      }
      if (
        !mountedRef.current ||
        requestId !== imageRenderRequestIdRef.current ||
        !draftRef.current?.xiaohongshu
      ) {
        return;
      }
      const latest = draftRef.current;
      const imagePlan = mergeImportedUrlsIntoImagePlan(
        latest.xiaohongshu!.imagePlan,
        payload.images
      );
      applyImagePlan(latest, imagePlan);
      const missing = countMissingXiaohongshuImages(imagePlan);
      if (missing > 0) {
        toast.success(
          `已从 ${payload.folder} 导入 ${payload.images.length} 张；仍缺 ${missing} 张可用「生成配图」补全`
        );
      } else {
        toast.success(`已从 ${payload.folder} 导入全部配图`);
      }
    } finally {
      if (mountedRef.current && requestId === imageRenderRequestIdRef.current) {
        imageRenderInFlightRef.current = false;
        setImageRendering(false);
        setImageProgress("");
      }
    }
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
            <Button
              variant="outline"
              size="sm"
              disabled={converting}
              onClick={() => void convertFull(true)}
            >
              {converting ? "转换中…" : "重新转换全文"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Tabs value={tone} onValueChange={(value) => selectTone(value as XiaohongshuTone)}>
              <TabsList>
                <TabsTrigger value="professional">专业轻表达</TabsTrigger>
                <TabsTrigger value="social">强氛围版 ✨</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="w-full space-y-1 sm:w-48">
              <label className="text-sm">状态</label>
              <Select value={draft.status} onValueChange={(value) => updateStatus(value as ContentStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>标题</span>
              <span
                className={
                  countXiaohongshuChars(variant.title) > XIAOHONGSHU_TITLE_MAX_CHARS
                    ? "text-rose-600"
                    : undefined
                }
              >
                {countXiaohongshuChars(variant.title)}/{XIAOHONGSHU_TITLE_MAX_CHARS}
              </span>
            </div>
            <Input
              value={variant.title}
              maxLength={XIAOHONGSHU_TITLE_MAX_CHARS}
              onChange={(event) =>
                updateVariant({ title: clampXiaohongshuTitle(event.target.value) })
              }
              placeholder="小红书标题（≤20 字）"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>正文</span>
              <span
                className={
                  countXiaohongshuChars(variant.body) > XIAOHONGSHU_BODY_MAX_CHARS
                    ? "text-rose-600"
                    : undefined
                }
              >
                {countXiaohongshuChars(variant.body)}/{XIAOHONGSHU_BODY_MAX_CHARS}
              </span>
            </div>
            <Textarea
              value={variant.body}
              maxLength={XIAOHONGSHU_BODY_MAX_CHARS}
              onChange={(event) => {
                const body = clampXiaohongshuBody(event.target.value);
                updateVariant({
                  body,
                  cta: "",
                  hashtags: extractHashtagsFromText(body),
                });
              }}
              rows={18}
              className="font-mono text-sm leading-relaxed"
              placeholder={"讲解正文 + 一句互动收尾 + 文末 #话题1 #话题2 …（≤1000 字，话题必须带 #）"}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveDraft}>保存小红书稿件</Button>
            <Button variant="outline" disabled={reviewing} onClick={() => void runReview()}>
              {reviewing ? "质检中…" : "运行小红书质检"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <XiaohongshuPublishPanel
        data={data}
        tone={tone}
        sourceTitle={sourceContent?.title}
        review={currentReview}
        onReplanImagePrompts={replanImagePrompts}
        onGenerateImages={generateRenderedImages}
        onImportLocalImages={importLocalImages}
        imageRegenerating={imageRegenerating}
        imageRendering={imageRendering}
        imageProgress={job?.running ? job.progress : imageProgress || job?.progress}
      />

      {latestReview ? (
        <ReviewIssuesPanel key={`${latestReview.id}-${tone}`} review={latestReview}
          draft={{ platform: "xiaohongshu", title: variant.title, body: variant.body,
            visualDirection: data.visualDirection, imagePlan: data.imagePlan }}
          sourceBody={sourceContent?.body} supplementaryNotes={sourceContent?.supplementaryNotes}
          targetAudience={publishVoice.audience} stale={!currentReview}
          disabled={reviewing || converting || imageRegenerating || imageRendering}
          onApply={(revised) => {
            const current = draftRef.current;
            if (!current?.xiaohongshu) return;
            const next = saveXiaohongshuVariant(current, tone,
              { ...current.xiaohongshu.variants[tone], title: revised.title, body: revised.body },
              new Date().toISOString());
            if (!next.xiaohongshu) return;
            next.xiaohongshu.imagePlan = revised.imagePlan ?? next.xiaohongshu.imagePlan;
            next.xiaohongshu.visualDirection = revised.visualDirection ?? next.xiaohongshu.visualDirection;
            next.coverCopy = next.xiaohongshu.imagePlan[0]?.overlayText ?? next.coverCopy;
            next.status = "编辑中";
            draftRef.current = next;
            setDraft(next);
            onSave(next, "ai_rewrite");
          }} />
      ) : null}
    </div>
  );
}
