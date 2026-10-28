"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { xiaohongshuOutputSchema } from "@/lib/ai/schemas";
import { requestXiaohongshuConversion } from "@/lib/api-client";
import { hasText } from "@/lib/has-text";
import { createXiaohongshuContent } from "@/lib/xiaohongshu/content";
import type { ContentItem, PublishVoice } from "@/types/domain";
import { sourceSignature, type XiaohongshuDraftSession } from "./use-xiaohongshu-draft";

export async function requestConversion(sourceContent: ContentItem, publishVoice: PublishVoice) {
  const payload = await requestXiaohongshuConversion({
    sourceContent: {
      id: sourceContent.id,
      title: sourceContent.title,
      digest: sourceContent.digest,
      body: sourceContent.body,
      cta: sourceContent.cta,
      supplementaryNotes: sourceContent.supplementaryNotes,
    },
    voice: publishVoice,
  });
  return xiaohongshuOutputSchema.parse(payload);
}

/** 全文转换：公众号稿 → 小红书两版文案 + 图片规划，成功后启动后台生图 */
export function useXiaohongshuConversion(input: {
  session: XiaohongshuDraftSession;
  sourceContent: ContentItem | null;
  publishVoice: PublishVoice;
  isImageJobRunning: (contentId: string) => boolean;
  /** 转换开始前取消进行中的质检/生图等请求 */
  cancelPending: () => void;
  renderImages: (content: ContentItem) => Promise<void>;
  onSave: (content: ContentItem, source: "ai_generate" | "user_edit" | "ai_rewrite") => void;
  conversionRequestId: number;
  onConversionSuccess?: () => void;
  onConversionSettled?: (success: boolean) => void;
}) {
  const { session, sourceContent, conversionRequestId, onConversionSettled } = input;
  const { draftRef, sourceContentRef, mountedRef, conversionInFlightRef } = session;
  const [converting, setConverting] = useState(false);
  const handledRequestIdRef = useRef(0);

  const convertFull = async (confirmOverwrite: boolean) => {
    if (conversionInFlightRef.current) return false;
    if (input.isImageJobRunning(draftRef.current?.id ?? "")) {
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
    if (hasExistingDraft && currentDraft) input.onSave(currentDraft, "user_edit");

    const requestedSourceSignature = sourceSignature(source);
    input.cancelPending();
    conversionInFlightRef.current = true;
    setConverting(true);
    try {
      const result = await requestConversion(source, input.publishVoice);
      if (!mountedRef.current || sourceSignature(sourceContentRef.current) !== requestedSourceSignature) {
        return false;
      }
      const next = session.commitDraft(
        createXiaohongshuContent({
          source,
          result,
          now: new Date().toISOString(),
          existing: currentDraft ?? undefined,
        }),
        hasExistingDraft ? "ai_rewrite" : "ai_generate"
      );
      input.onConversionSuccess?.();
      toast.success(hasExistingDraft ? "文案已更新，开始生成配图…" : "文案已生成，开始生成配图…");
      conversionInFlightRef.current = false;
      setConverting(false);
      void input.renderImages(next);
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
  };

  const handleConversionRequest = useEffectEvent(() => {
    void convertFull(true).then((success) => {
      if (mountedRef.current) onConversionSettled?.(success);
    });
  });

  useEffect(() => {
    if (conversionRequestId <= 0 || conversionRequestId === handledRequestIdRef.current) return;
    handledRequestIdRef.current = conversionRequestId;
    handleConversionRequest();
  }, [conversionRequestId]);

  return { converting, convertFull };
}
