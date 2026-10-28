"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createImportBaseline } from "@/lib/content-baseline";
import { requiresPublishChecks, shouldStampPublishedAt } from "@/lib/content-status";
import {
  appendSupplementaryDocument,
  extractTextFromUpload,
} from "@/lib/extract-document-text";
import { toFactSnapshot } from "@/lib/fact-diff";
import { createId } from "@/lib/ids";
import { upsertCoverPlaceholder } from "@/lib/illustrations/enrich-article-media";
import type { CoverImageVariant } from "@/lib/illustrations/cover";
import { parseMarkdownDraft } from "@/lib/import-markdown";
import { projectToDraftFields, type ImportedMarkdownProject } from "@/lib/import-markdown-project";
import type { ReviewRevisionDraft } from "@/lib/review-revision";
import { formatScheduleLabel, isWeekdayDateKey } from "@/lib/schedule";
import type { ContentItem, ContentStatus, Topic } from "@/types/domain";
import type { WechatDraft } from "./use-wechat-draft";

/** 公众号草稿上的一次性编辑动作：导入、恢复、状态/排期、事实 Diff、质检修改等 */
export function useWechatDraftActions(input: {
  draft: WechatDraft;
  persistDraft: WechatDraft["persistDraft"];
  loadContent: (content: ContentItem) => void;
  selectedTopic: Topic | undefined;
  activeTopicId: string;
  activeContent: ContentItem | undefined;
  coverSummary: string | undefined;
  upsertContent: (item: ContentItem) => void;
  setContentSchedule: (id: string, dateKey: string | null, options?: { cascade?: boolean }) => void;
  unlockContentSchedule: (id: string) => void;
}) {
  const { draft, persistDraft, selectedTopic, activeTopicId, activeContent } = input;
  const { fields } = draft;
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importRaw, setImportRaw] = useState("");
  const [supplementaryDocLoading, setSupplementaryDocLoading] = useState(false);
  const factBlocked = Boolean(draft.factDiffReport?.blocking && !draft.factDiffAcknowledged);

  const persistImported = (imported: { title: string; digest?: string; body: string }) => {
    if (!selectedTopic) return;
    const baseline = createImportBaseline({
      title: imported.title,
      body: imported.body,
      digest: imported.digest,
      coverCopy: fields.coverCopy,
      cta: fields.cta,
    });
    persistDraft(
      {
        id: activeContent?.id ?? createId("content"),
        topicId: selectedTopic.id,
        source: "imported",
        title: imported.title,
        digest: imported.digest,
        coverCopy: fields.coverCopy,
        body: imported.body,
        cta: fields.cta,
        importBaseline: baseline,
        status: "编辑中",
      },
      "user_edit"
    );
    setImportDialogOpen(false);
    setImportRaw("");
  };

  const importDraft = () => {
    if (!selectedTopic) {
      toast.error("请先选择选题");
      return;
    }
    const parsed = parseMarkdownDraft(importRaw);
    if (!parsed.body.trim()) {
      toast.error("请粘贴或上传有效 Markdown 正文");
      return;
    }
    persistImported({
      title: parsed.title || selectedTopic.title,
      digest: parsed.digest ?? fields.digest,
      body: parsed.body,
    });
    toast.success("草稿已导入");
  };

  const applyImportedProject = (project: ImportedMarkdownProject) => {
    if (!selectedTopic) {
      toast.error("请先选择选题");
      return;
    }
    const imported = projectToDraftFields(project);
    if (!imported.body.trim()) {
      toast.error("项目中没有有效正文");
      return;
    }
    persistImported(imported);
    toast.success(
      `项目已导入：${project.uploadedImages} 张图片已上传${
        project.skippedImages > 0 ? `，${project.skippedImages} 处未匹配` : ""
      }`
    );
  };

  const restoreOriginalDraft = () => {
    const baseline = activeContent?.importBaseline;
    if (!activeContent || !baseline?.body?.trim()) {
      toast.error("没有可恢复的原始草稿（需先导入 Markdown）");
      return;
    }
    persistDraft(
      {
        id: activeContent.id,
        topicId: activeTopicId,
        title: baseline.title,
        digest: baseline.digest,
        coverCopy: baseline.coverCopy,
        body: baseline.body,
        cta: baseline.cta,
        importBaseline: baseline,
      },
      "restore"
    );
    toast.success("已恢复原始草稿");
  };

  const discardChanges = () => {
    draft.cancelAutosave();
    if (activeContent) input.loadContent(activeContent);
  };

  const changeStatus = (target: ContentStatus) => {
    if (requiresPublishChecks(target) && factBlocked) {
      toast.error("事实 Diff 未确认，不能标记为待发布/已发布");
      return;
    }
    draft.updateFields({ status: target });
    if (!activeContent) return;
    const publishedAt = shouldStampPublishedAt(target)
      ? activeContent.publishedAt ?? new Date().toISOString()
      : activeContent.publishedAt;
    input.upsertContent({
      ...activeContent,
      status: target,
      publishedAt,
      updatedAt: new Date().toISOString(),
    });
    toast.success(`状态已更新为 ${target}`);
  };

  const changeSchedule = (dateKey: string) => {
    if (!activeContent) {
      toast.error("请先保存稿件再设置排期");
      return;
    }
    const nextKey = dateKey.trim() || null;
    if (nextKey && !isWeekdayDateKey(nextKey)) {
      toast.message("所选日期不是工作日，仍按手动日期保存");
    }
    input.setContentSchedule(activeContent.id, nextKey, { cascade: true });
    toast.success(
      nextKey ? `排期已手动锁定为 ${formatScheduleLabel(nextKey)}` : "已取消并锁定为不排期"
    );
  };

  const unlockSchedule = () => {
    if (!activeContent) return;
    input.unlockContentSchedule(activeContent.id);
    toast.success("已纳入自动排期");
  };

  const applyCoverVariant = (variant: CoverImageVariant) => {
    const nextBody = upsertCoverPlaceholder(fields.body, variant);
    const nextCover =
      !fields.coverCopy.trim() && variant.overlayText.trim()
        ? variant.overlayText.trim()
        : fields.coverCopy;
    draft.updateFields({ body: nextBody, coverCopy: nextCover });
    persistDraft(
      {
        id: activeContent?.id ?? createId("content"),
        topicId: activeTopicId,
        body: nextBody,
        coverCopy: nextCover,
        coverPromptPack: { summary: input.coverSummary, variants: [variant] },
      },
      "ai_generate"
    );
    toast.success("封面提示词已写入正文开头");
  };

  const acknowledgeFactDiff = () => {
    draft.setFactDiffAcknowledged(true);
    if (activeContent && draft.factDiffReport) {
      persistDraft(
        {
          id: activeContent.id,
          topicId: activeTopicId,
          lastFactDiff: toFactSnapshot(draft.factDiffReport, new Date().toISOString()),
        },
        "user_edit"
      );
    }
    toast.success("已确认事实 Diff，可标记待发布");
  };

  const applyReviewRevision = (revised: ReviewRevisionDraft) => {
    if (!activeContent) return;
    persistDraft(
      {
        id: activeContent.id,
        topicId: activeTopicId,
        title: revised.title,
        body: revised.body,
        digest: revised.digest,
        coverCopy: revised.coverCopy,
        cta: revised.cta,
        status: "编辑中",
      },
      "ai_rewrite"
    );
  };

  const uploadSupplementaryDoc = async (file: File) => {
    setSupplementaryDocLoading(true);
    try {
      const extracted = await extractTextFromUpload(file);
      if (!extracted.trim()) {
        toast.error("未能从文档中提取文字");
        return;
      }
      const merged = appendSupplementaryDocument(fields.supplementaryNotes, file.name, extracted);
      draft.updateFields({ supplementaryNotes: merged });
      if (activeContent) {
        persistDraft(
          { id: activeContent.id, topicId: activeTopicId, supplementaryNotes: merged },
          "user_edit"
        );
      }
      toast.success(`已解析「${file.name}」并追加到补充信息`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "文档解析失败");
    } finally {
      setSupplementaryDocLoading(false);
    }
  };

  return {
    factBlocked,
    importDialogOpen,
    setImportDialogOpen,
    importRaw,
    setImportRaw,
    supplementaryDocLoading,
    importDraft,
    applyImportedProject,
    restoreOriginalDraft,
    discardChanges,
    changeStatus,
    changeSchedule,
    unlockSchedule,
    applyCoverVariant,
    acknowledgeFactDiff,
    applyReviewRevision,
    uploadSupplementaryDoc,
  };
}
