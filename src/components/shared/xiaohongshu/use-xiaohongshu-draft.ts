"use client";

import { useEffect, useRef, useState } from "react";
import { useImageJobs } from "@/lib/store/app-store";
import { imagePlanSignature } from "@/lib/xiaohongshu/merge-generated-image";
import { normalizeXiaohongshuContent } from "@/lib/xiaohongshu/content";
import type { ContentItem } from "@/types/domain";

export type XiaohongshuSaveSource = "ai_generate" | "user_edit" | "ai_rewrite";

export function sourceSignature(content: ContentItem | null): string {
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

/** 小红书编辑器的共享会话状态：本地草稿、来源稿引用与跨异步流程的标志位 */
export function useXiaohongshuDraft(input: {
  content: ContentItem | null;
  sourceContent: ContentItem | null;
  onSave: (content: ContentItem, source: XiaohongshuSaveSource) => void;
}) {
  const { content, sourceContent } = input;
  const [draft, setDraft] = useState<ContentItem | null>(content);
  const imageJobs = useImageJobs();
  const job = imageJobs[draft?.id ?? ""];
  const jobRunning = Boolean(job?.running);
  const draftRef = useRef<ContentItem | null>(draft);
  const sourceContentRef = useRef<ContentItem | null>(sourceContent);
  const mountedRef = useRef(true);
  const conversionInFlightRef = useRef(false);
  const previousImageRunning = useRef(false);

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
    if (current?.id === content.id && current.updatedAt === content.updatedAt && current.xiaohongshu) {
      return;
    }
    let normalized = normalizeXiaohongshuContent(content);
    if (
      current?.id === content.id &&
      current.xiaohongshu &&
      normalized.xiaohongshu &&
      (jobRunning || previousImageRunning.current)
    ) {
      const incoming = normalized.xiaohongshu.imagePlan;
      normalized = {
        ...current,
        updatedAt: content.updatedAt,
        xiaohongshu: {
          ...current.xiaohongshu,
          imagePlan: current.xiaohongshu.imagePlan.map((image) => {
            const next = incoming.find(
              (candidate) =>
                candidate.index === image.index &&
                imagePlanSignature(candidate) === imagePlanSignature(image)
            );
            return next ? { ...image, imageUrl: next.imageUrl, imageError: next.imageError } : image;
          }),
        },
      };
    }
    draftRef.current = normalized;
    setDraft(normalized);
  }, [content, jobRunning]);

  useEffect(() => {
    previousImageRunning.current = jobRunning;
  }, [jobRunning]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** 写入本地草稿；传入 source 时同时保存到 store */
  const commitDraft = (next: ContentItem, source?: XiaohongshuSaveSource) => {
    draftRef.current = next;
    setDraft(next);
    if (source) input.onSave(next, source);
    return next;
  };

  /** 基于最新草稿做纯函数更新（仅本地，不保存） */
  const updateDraft = (updater: (current: ContentItem) => ContentItem) => {
    setDraft((current) => {
      if (!current?.xiaohongshu) return current;
      const next = updater(current);
      draftRef.current = next;
      return next;
    });
  };

  return {
    draft,
    job,
    imageJobs,
    draftRef,
    sourceContentRef,
    mountedRef,
    conversionInFlightRef,
    commitDraft,
    updateDraft,
  };
}

export type XiaohongshuDraftSession = ReturnType<typeof useXiaohongshuDraft>;
