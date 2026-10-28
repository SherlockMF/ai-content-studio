"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { FactDiffPanel } from "@/components/shared/fact-diff-panel";
import { ReviewIssuesPanel } from "@/components/shared/review-issues-panel";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { WechatPublishPanel } from "@/components/shared/wechat-publish-panel";
import { ArticleImageSlots } from "@/components/shared/article-image-slots";
import { Card, CardContent } from "@/components/ui/card";
import { hasImportBaseline } from "@/lib/content-baseline";
import { countExportableImages } from "@/lib/export-markdown-bundle";
import type { ContentItem, KnowledgeReference, Topic } from "@/types/domain";
import type { useBodyInsertion } from "../hooks/use-body-insertion";
import type { ContentMedia } from "../hooks/use-content-media";
import type { useContentReview } from "../hooks/use-content-review";
import type { WechatDraft } from "../hooks/use-wechat-draft";
import type { useWechatDraftActions } from "../hooks/use-wechat-draft-actions";
import type { useWechatGeneration } from "../hooks/use-wechat-generation";
import { WechatDraftExtras } from "./wechat-draft-extras";
import { WechatDraftForm } from "./wechat-draft-form";
import { WechatEditorActions } from "./wechat-editor-actions";

export function WechatDraftPanel({
  draft,
  media,
  review,
  generation,
  actions,
  bodyInsertion,
  selectedTopic,
  activeContent,
  isImported,
  isEvaluation,
  targetAudience,
  knowledgeReferences,
  onKnowledgeReferencesChange,
}: {
  draft: WechatDraft;
  media: ContentMedia;
  review: ReturnType<typeof useContentReview>;
  generation: ReturnType<typeof useWechatGeneration>;
  actions: ReturnType<typeof useWechatDraftActions>;
  bodyInsertion: ReturnType<typeof useBodyInsertion>;
  selectedTopic: Topic | undefined;
  activeContent: ContentItem | undefined;
  isImported: boolean;
  isEvaluation: boolean;
  targetAudience: string;
  knowledgeReferences: KnowledgeReference[];
  onKnowledgeReferencesChange: (value: KnowledgeReference[]) => void;
}) {
  const { fields } = draft;
  const hasDraft = Boolean(activeContent || fields.body.trim());
  const exportableImages = useMemo(() => countExportableImages(fields.body), [fields.body]);
  const knowledgeQuery = useMemo(
    () =>
      [selectedTopic?.title, selectedTopic?.coreViewpoint, selectedTopic?.painPoint, selectedTopic?.section]
        .filter(Boolean)
        .join("\n"),
    [selectedTopic]
  );
  const editorActionProps = {
    title: fields.title,
    body: fields.body,
    hasTopic: Boolean(selectedTopic),
    media,
    reviewLoading: review.reviewLoading,
    mediaLoading: generation.wechatMediaLoading,
    onSave: () => { draft.flushAutosave(); toast.success("草稿已保存"); },
    onInsertSnippet: bodyInsertion.insertIntoBody,
    onApplyCoverVariant: actions.applyCoverVariant,
    onRunReview: () => void review.runReview(),
  };

  return (
    <>
      {generation.error ? <ErrorState message={generation.error} /> : null}
      <Card>
        <CardContent className="space-y-3 pt-4">
          {!hasDraft ? (
            <EmptyState
              title="暂无稿件"
              description="可导入已有 Markdown 测评稿，或在选题页通过热点流程 AI 生成。"
            />
          ) : (
            <>
              <WechatDraftForm
                fields={fields}
                onChange={draft.updateFields}
                isEvaluation={isEvaluation}
                section={selectedTopic?.section}
                textareaRef={bodyInsertion.textareaRef}
                onBodySelection={bodyInsertion.rememberSelection}
              />
              <WechatEditorActions {...editorActionProps} placement="main" />
              <WechatDraftExtras
                isImported={isImported}
                isEvaluation={isEvaluation}
                hasTopic={Boolean(selectedTopic)}
                canRestoreOriginal={hasImportBaseline(activeContent)}
                canDiscard={Boolean(activeContent)}
                onOpenImport={() => actions.setImportDialogOpen(true)}
                onRestoreOriginal={actions.restoreOriginalDraft}
                onDiscard={actions.discardChanges}
                knowledgeQuery={knowledgeQuery}
                knowledgeReferences={knowledgeReferences}
                onKnowledgeReferencesChange={onKnowledgeReferencesChange}
                supplementaryNotes={fields.supplementaryNotes}
                onSupplementaryNotesChange={(value) => draft.updateFields({ supplementaryNotes: value })}
                supplementaryDocLoading={actions.supplementaryDocLoading}
                onUploadSupplementaryDoc={actions.uploadSupplementaryDoc}
              >
                <WechatEditorActions {...editorActionProps} placement="extra" />
              </WechatDraftExtras>
              <FactDiffPanel
                report={draft.factDiffReport}
                acknowledged={draft.factDiffAcknowledged}
                onAcknowledge={actions.acknowledgeFactDiff}
              />
              <WechatPublishPanel
                key={selectedTopic?.id ?? activeContent?.topicId}
                title={fields.title}
                digest={fields.digest}
                body={fields.body}
                layout={fields.wechatLayout}
                onLayoutChange={(wechatLayout) => draft.updateFields({ wechatLayout })}
                reviewScore={review.latestReview?.score}
                exportableLocalImages={exportableImages.local}
                placeholderImages={exportableImages.placeholder}
                factDiff={draft.factDiffReport}
                factDiffAcknowledged={draft.factDiffAcknowledged}
              />
              <ArticleImageSlots body={fields.body} topicId={selectedTopic?.id ?? activeContent?.topicId ?? ""} draftRef={draft.draftRef} onChange={draft.setBody} actions={<WechatEditorActions {...editorActionProps} placement="images" />} />
              {review.latestReviewRecord ? (
                <ReviewIssuesPanel
                  key={review.latestReviewRecord.id}
                  review={review.latestReviewRecord}
                  draft={review.revisionDraft}
                  supplementaryNotes={fields.supplementaryNotes}
                  targetAudience={targetAudience}
                  stale={!review.latestReview}
                  disabled={review.reviewLoading || generation.generateLoading || generation.wechatMediaLoading}
                  onApply={actions.applyReviewRevision}
                />
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
