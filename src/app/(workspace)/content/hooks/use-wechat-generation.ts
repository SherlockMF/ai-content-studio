"use client";

import { useState } from "react";
import { toast } from "sonner";
import { requestWechatArticle, type WechatArticleResponse } from "@/lib/api-client";
import { isEvaluationDraft } from "@/lib/draft-profile";
import { toFactSnapshot } from "@/lib/fact-diff";
import { createId } from "@/lib/ids";
import { generateWechatMedia } from "@/lib/illustrations/wechat-media-client";
import {
  formatMediaStepToast,
  hasWechatBodyImages,
  shouldSkipDeAi,
} from "@/lib/wechat-publish-prep";
import type {
  ContentItem,
  ContentSource,
  KnowledgeReference,
  MaterialItem,
  PublishVoice,
  Topic,
  WechatGenerateMode,
} from "@/types/domain";
import type { WechatDraft } from "./use-wechat-draft";

const GENERATION_LABELS: Record<WechatGenerateMode, string> = {
  from_scratch: "已重新生成图文",
  polish: "已润色草稿",
  preserve_structure: "已润色",
};

const LONG_BODY_HINT = "长文将分段润色，可能需要 1–2 分钟，请稍候";

export function useWechatGeneration(input: {
  draft: WechatDraft;
  persistDraft: WechatDraft["persistDraft"];
  selectedTopic: Topic | undefined;
  activeTopicId: string;
  activeContent: ContentItem | undefined;
  isImported: boolean;
  publishVoice: PublishVoice;
  materials: MaterialItem[];
  knowledgeReferences: KnowledgeReference[];
  polishedAtByContent: Record<string, string>;
  upsertContent: (item: ContentItem) => void;
  runReview: (options?: { manageLoading?: boolean }) => Promise<void>;
}) {
  const { draft, selectedTopic, activeTopicId, activeContent } = input;
  const { fields } = draft;
  const [error, setError] = useState<string | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const [wechatMediaLoading, setWechatMediaLoading] = useState(false);
  const [wechatMediaProgress, setWechatMediaProgress] = useState("");

  const applyGenerationResult = (
    result: WechatArticleResponse,
    mode: WechatGenerateMode,
    source: ContentSource
  ) => {
    const contentId = activeContent?.id ?? createId("content");
    if (result.factDiff) {
      draft.setFactDiffReport(result.factDiff);
      draft.setFactDiffAcknowledged(!result.factDiff.blocking);
    }
    const coverPromptPack = result.coverVariants?.length
      ? { summary: result.coverSummary, variants: result.coverVariants }
      : undefined;
    const saved = input.persistDraft(
      {
        id: contentId,
        topicId: activeTopicId,
        source,
        title: result.title,
        digest: result.digest,
        coverCopy: result.coverCopy,
        body: result.body,
        cta: result.cta,
        coverPromptPack,
        lastFactDiff: result.factDiff
          ? toFactSnapshot(
              result.factDiff,
              result.factDiff.blocking ? undefined : new Date().toISOString()
            )
          : undefined,
        status: mode === "from_scratch" && source === "ai" ? "AI 草稿" : fields.status,
      },
      mode === "polish" || mode === "preserve_structure" ? "ai_rewrite" : "ai_generate"
    );
    const mediaHint =
      mode === "from_scratch"
        ? [
            result.illustrationInserted ? `正文配图 ${result.illustrationInserted} 处` : null,
            result.coverVariants?.length ? "封面提示词已就绪" : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : "";
    const label = GENERATION_LABELS[mode];
    if (result.factDiff?.blocking) {
      toast.message(label, {
        description: "事实 Diff 发现关键数值变化，请确认后再标「待发布」",
      });
    } else {
      toast.success(mediaHint ? `${label} · ${mediaHint}` : label);
    }
    return saved;
  };

  const runMediaForContent = async (
    content: ContentItem,
    previousBody?: string,
    options?: { manageLoading?: boolean }
  ) => {
    const manageLoading = options?.manageLoading !== false;
    if (manageLoading) setWechatMediaLoading(true);
    let expectedBody = content.body;
    try {
      const result = await generateWechatMedia({
        title: content.title,
        body: content.body,
        previousBody,
        onProgress: setWechatMediaProgress,
        onUpdate: (body) => {
          const { contentItemsRef, draftRef } = draft;
          const latest = contentItemsRef.current.find((item) => item.id === content.id);
          if (
            !latest ||
            latest.body !== expectedBody ||
            (draftRef.current.topicId === content.topicId && draftRef.current.body !== expectedBody)
          ) {
            throw new Error("正文已变化，已停止配图更新，避免覆盖你的修改");
          }
          const next = { ...latest, body, updatedAt: new Date().toISOString() };
          expectedBody = body;
          contentItemsRef.current = contentItemsRef.current.map((item) =>
            item.id === next.id ? next : item
          );
          input.upsertContent(next);
          if (draftRef.current.topicId === content.topicId) {
            draftRef.current = { ...draftRef.current, body };
            draft.setBody(body);
          }
        },
      });
      const message = formatMediaStepToast({
        hasImages: hasWechatBodyImages(result.body),
        failures: result.failures,
      });
      if (result.failures.length) toast.error(message);
      else toast.success(message);
      return { ok: result.failures.length === 0, failures: result.failures };
    } catch (err) {
      const message = err instanceof Error ? err.message : "配图失败";
      toast.error(`文案已保存，配图未完成：${message}`);
      return { ok: false, failures: [message] };
    } finally {
      if (manageLoading) {
        setWechatMediaLoading(false);
        setWechatMediaProgress("");
      }
    }
  };

  /** 仅去 AI 味（不配图）；失败抛错供发布前检查中断。 */
  const runDeAiForContent = async (content: ContentItem): Promise<ContentItem> => {
    if (!selectedTopic) throw new Error("请先选择选题");
    const mode: WechatGenerateMode = isEvaluationDraft({
      topicId: content.topicId,
      body: content.body,
    })
      ? "preserve_structure"
      : "polish";
    if (content.body.length > 2500) toast.message(LONG_BODY_HINT);
    const result = await requestWechatArticle(
      {
        voice: input.publishVoice,
        materials: input.materials,
        knowledgeReferences: input.knowledgeReferences,
        topic: selectedTopic,
        mode,
        existingBody: content.body,
        existingMeta: {
          title: content.title,
          digest: content.digest,
          coverCopy: content.coverCopy,
          cta: content.cta,
        },
        supplementaryNotes: content.supplementaryNotes?.trim() || undefined,
      },
      "去 AI 味失败"
    );
    const current = draft.draftRef.current;
    if (current.topicId !== content.topicId || current.body !== content.body) {
      throw new Error("稿件已切换或正文已修改，去 AI 味结果未覆盖当前内容");
    }
    return applyGenerationResult(result, mode, content.source);
  };

  /** 发布前检查：去 AI 味（可跳过）→ 补图 → 质检 */
  const runPublishPrepCheck = async () => {
    const saved = draft.flushAutosave();
    if (!saved?.body.trim()) {
      toast.error("请先填写正文");
      return;
    }
    setWechatMediaLoading(true);
    try {
      let content = saved;
      if (
        shouldSkipDeAi({
          source: content.source,
          polishedAt: input.polishedAtByContent[content.id],
        })
      ) {
        setWechatMediaProgress("已去过 AI 味，跳过");
        toast.message("已去过 AI 味，跳过");
      } else {
        setWechatMediaProgress("去 AI 味中…");
        content = await runDeAiForContent(content);
      }

      // 无图位也走 media-plan：规划封面+正文图并生成，不再「补图：无图」跳过
      setWechatMediaProgress(
        hasWechatBodyImages(content.body) ? "检查配图…" : "规划并生成配图…"
      );
      await runMediaForContent(content, content.body, { manageLoading: false });

      setWechatMediaProgress("质检中…");
      await input.runReview({ manageLoading: false });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "发布前检查失败");
    } finally {
      setWechatMediaLoading(false);
      setWechatMediaProgress("");
    }
  };

  const runGeneration = async (mode: WechatGenerateMode) => {
    if (!selectedTopic) {
      toast.error("请先选择选题");
      return;
    }
    const startBody = fields.body;
    setGenerateLoading(true);
    setError(null);
    setRegenDialogOpen(false);
    if (mode !== "from_scratch" && startBody.length > 2500) toast.message(LONG_BODY_HINT);
    try {
      const result = await requestWechatArticle({
        voice: input.publishVoice,
        materials: input.materials,
        knowledgeReferences: input.knowledgeReferences,
        topic: selectedTopic,
        mode,
        existingBody: mode === "from_scratch" ? undefined : startBody,
        existingMeta: {
          title: fields.title,
          digest: fields.digest,
          coverCopy: fields.coverCopy,
          cta: fields.cta,
        },
        supplementaryNotes: fields.supplementaryNotes.trim() || undefined,
      });

      const nextSource: ContentSource =
        mode === "from_scratch" ? "ai" : activeContent?.source ?? fields.source;
      const current = draft.draftRef.current;
      if (current.topicId !== activeTopicId || current.body !== startBody) {
        throw new Error("稿件已切换或正文已修改，生成结果未覆盖当前内容");
      }
      const saved = applyGenerationResult(result, mode, nextSource);
      await runMediaForContent(saved, mode === "from_scratch" ? undefined : startBody);
    } catch (err) {
      const message = err instanceof Error ? err.message : "生成失败";
      setError(message);
      toast.error(message);
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleRegenerateClick = () => {
    if (!selectedTopic) {
      toast.error("请先选择选题");
      return;
    }
    if (input.isImported && fields.body.trim()) {
      setRegenDialogOpen(true);
      return;
    }
    void runGeneration("from_scratch");
  };

  return {
    error,
    generateLoading,
    regenDialogOpen,
    setRegenDialogOpen,
    wechatMediaLoading,
    wechatMediaProgress,
    runGeneration,
    runPublishPrepCheck,
    handleRegenerateClick,
  };
}
