"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { XIAOHONGSHU_FIXED_VISUAL_DIRECTION } from "@/lib/xiaohongshu/visual-rules";
import { importLocalXiaohongshuImages } from "@/lib/api-client";
import { hasText } from "@/lib/has-text";
import { useStoreActions } from "@/lib/store/app-store";
import { countMissingXiaohongshuImages } from "@/lib/xiaohongshu/generate-images";
import { mergeImportedUrlsIntoImagePlan } from "@/lib/xiaohongshu/import-local-images-shared";
import type { ContentItem, PublishVoice, XiaohongshuImagePrompt } from "@/types/domain";
import { requestConversion } from "./use-xiaohongshu-conversion";
import { sourceSignature, type XiaohongshuDraftSession } from "./use-xiaohongshu-draft";

/** 小红书图片：重新规划提示词、后台生图、导入本地配图 */
export function useXiaohongshuImages(input: {
  session: XiaohongshuDraftSession;
  publishVoice: PublishVoice;
  onSave: (content: ContentItem, source: "ai_generate" | "user_edit" | "ai_rewrite") => void;
}) {
  const { session } = input;
  const { job, imageJobs, draftRef, sourceContentRef, mountedRef, conversionInFlightRef } = session;
  const { generateXiaohongshuImages } = useStoreActions();
  const [imageRegenerating, setImageRegenerating] = useState(false);
  const [imageImporting, setImageImporting] = useState(false);
  const [imageProgress, setImageProgress] = useState("");
  const replanRequestIdRef = useRef(0);
  const importRequestIdRef = useRef(0);
  const importInFlightRef = useRef(false);
  const imageRendering = imageImporting || Boolean(job?.running);

  const isImageJobRunning = (contentId: string) => Boolean(imageJobs[contentId]?.running);

  const renderImages = async (content: ContentItem, onlyMissing = false) => {
    if (!content.xiaohongshu) return;
    await generateXiaohongshuImages(content, onlyMissing);
  };

  const cancelImageRequests = () => {
    replanRequestIdRef.current += 1;
    importRequestIdRef.current += 1;
    setImageRegenerating(false);
    setImageImporting(false);
    setImageProgress("");
  };

  const applyImagePlan = (content: ContentItem, imagePlan: XiaohongshuImagePrompt[]) => {
    if (!content.xiaohongshu) return content;
    return session.commitDraft(
      {
        ...content,
        coverCopy: imagePlan[0]?.overlayText ?? content.coverCopy,
        xiaohongshu: {
          ...content.xiaohongshu,
          visualDirection: content.xiaohongshu.visualDirection || XIAOHONGSHU_FIXED_VISUAL_DIRECTION,
          imagePlan,
        },
        updatedAt: new Date().toISOString(),
      },
      "ai_rewrite"
    );
  };

  const replanImagePrompts = async () => {
    if (conversionInFlightRef.current) {
      throw new Error("全文转换进行中，请稍后再规划图片");
    }
    const source = sourceContentRef.current;
    if (!source || !hasText(source.body)) {
      throw new Error("来源公众号正文不可用，无法重新规划图片");
    }
    const requestedSourceSignature = sourceSignature(source);
    const requestId = ++replanRequestIdRef.current;
    setImageRegenerating(true);
    try {
      const result = await requestConversion(source, input.publishVoice);
      if (
        !mountedRef.current ||
        requestId !== replanRequestIdRef.current ||
        sourceSignature(sourceContentRef.current) !== requestedSourceSignature
      ) {
        return;
      }
      const currentDraft = draftRef.current;
      if (!currentDraft?.xiaohongshu) return;
      const next = session.commitDraft(
        {
          ...currentDraft,
          coverCopy: result.imagePlan[0]?.overlayText,
          xiaohongshu: {
            ...currentDraft.xiaohongshu,
            visualDirection: result.visualDirection || XIAOHONGSHU_FIXED_VISUAL_DIRECTION,
            imagePlan: result.imagePlan,
          },
          updatedAt: new Date().toISOString(),
        },
        "ai_rewrite"
      );
      toast.success("图片提示词已更新，开始生成配图…");
      await renderImages(next);
    } finally {
      if (mountedRef.current && requestId === replanRequestIdRef.current) {
        setImageRegenerating(false);
      }
    }
  };

  const generateRenderedImages = async (onlyMissing: boolean) => {
    const currentDraft = draftRef.current;
    if (!currentDraft?.xiaohongshu) {
      throw new Error("暂无小红书图片规划");
    }
    if (isImageJobRunning(currentDraft.id)) return;
    input.onSave(currentDraft, "user_edit");
    await renderImages(currentDraft, onlyMissing);
  };

  const importLocalImages = async () => {
    const currentDraft = draftRef.current;
    if (!currentDraft?.xiaohongshu) {
      throw new Error("暂无小红书图片规划");
    }
    if (imageRendering || importInFlightRef.current || conversionInFlightRef.current) {
      throw new Error("请等待当前转换/生图完成后再导入");
    }
    const requestId = ++importRequestIdRef.current;
    importInFlightRef.current = true;
    setImageImporting(true);
    setImageProgress("正在导入本地配图…");
    try {
      const payload = await importLocalXiaohongshuImages({
        title: currentDraft.title,
        body: currentDraft.body,
      });
      if (!payload.images?.length) {
        throw new Error(payload.message || "导入本地配图失败");
      }
      const latest = draftRef.current;
      if (!mountedRef.current || requestId !== importRequestIdRef.current || !latest?.xiaohongshu) {
        return;
      }
      const imagePlan = mergeImportedUrlsIntoImagePlan(latest.xiaohongshu.imagePlan, payload.images);
      applyImagePlan(latest, imagePlan);
      const missing = countMissingXiaohongshuImages(imagePlan);
      toast.success(
        missing > 0
          ? `已从 ${payload.folder} 导入 ${payload.images.length} 张；仍缺 ${missing} 张可用「生成配图」补全`
          : `已从 ${payload.folder} 导入全部配图`
      );
    } finally {
      if (mountedRef.current && requestId === importRequestIdRef.current) {
        importInFlightRef.current = false;
        setImageImporting(false);
        setImageProgress("");
      }
    }
  };

  return {
    imageRegenerating,
    imageRendering,
    imageProgress: job?.running ? job.progress : imageProgress || job?.progress,
    isImageJobRunning,
    renderImages,
    cancelImageRequests,
    replanImagePrompts,
    generateRenderedImages,
    importLocalImages,
  };
}
