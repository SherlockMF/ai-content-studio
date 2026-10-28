"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/shared/app-shell";
import {
  IllustrationSuggestionsDialog,
  useIllustrationInsert,
} from "@/components/shared/illustration-suggestions-dialog";
import { MarkdownImportDialog } from "@/components/shared/markdown-import-dialog";
import { XiaohongshuEditor } from "@/components/shared/xiaohongshu-editor";
import { latestPolishByContent } from "@/lib/content-polish";
import { isPublishedLikeStatus } from "@/lib/content-status";
import { isEvaluationDraft } from "@/lib/draft-profile";
import { useContentState, useStoreActions, useStoreHydrated, useWorkspaceState } from "@/lib/store/app-store";
import { activeWechatContents, archivedWechatContents } from "@/lib/workspace-lists";
import type { ContentItem, KnowledgeReference } from "@/types/domain";
import { ContentListSidebar } from "./components/content-list-sidebar";
import { RegenerateDialog } from "./components/regenerate-dialog";
import { WechatDraftPanel } from "./components/wechat-draft-panel";
import { WechatEditorToolbar, type EditorPlatform } from "./components/wechat-editor-toolbar";
import { useBodyInsertion } from "./hooks/use-body-insertion";
import { useContentMedia } from "./hooks/use-content-media";
import { useContentReview } from "./hooks/use-content-review";
import { useContentSelection } from "./hooks/use-content-selection";
import { useWechatDraft, type DraftChangeSource, type DraftPatch } from "./hooks/use-wechat-draft";
import { useWechatDraftActions } from "./hooks/use-wechat-draft-actions";
import { useWechatGeneration } from "./hooks/use-wechat-generation";
import { useXiaohongshuHandoff } from "./hooks/use-xiaohongshu-handoff";

function resolveInitialTopicId(initialTopicId: string | null, orderedTopicIds: string[]) {
  if (initialTopicId && orderedTopicIds.includes(initialTopicId)) return initialTopicId;
  return orderedTopicIds[0];
}

export function ContentEditor({ initialTopicId }: { initialTopicId: string | null }) {
  const storeHydrated = useStoreHydrated();
  if (!storeHydrated) {
    return (
      <AppShell title="稿件 · 公众号图文">
        <p className="text-sm text-slate-500">加载本地草稿…</p>
      </AppShell>
    );
  }
  return <ContentEditorLoaded initialTopicId={initialTopicId} />;
}

function ContentEditorLoaded({ initialTopicId }: { initialTopicId: string | null }) {
  const { topics, publishVoice, materials } = useWorkspaceState();
  const { contentItems, versions, reviews } = useContentState();
  const store = useStoreActions();
  const { upsertContent, addVersion, addReview } = store;

  const activeContents = useMemo(() => activeWechatContents(contentItems), [contentItems]);
  const archivedContents = useMemo(() => archivedWechatContents(contentItems), [contentItems]);
  const contentTopicIds = useMemo(
    () => [
      ...new Set([
        ...activeContents.map((item) => item.topicId),
        ...archivedContents.map((item) => item.topicId),
        ...topics.map((topic) => topic.id),
      ]),
    ],
    [activeContents, archivedContents, topics]
  );
  const resolvedTopicId = resolveInitialTopicId(initialTopicId, contentTopicIds);
  const initialContent =
    contentItems.find((item) => item.topicId === resolvedTopicId && item.platform === "wechat") ??
    null;

  const [activeTopicId, setActiveTopicId] = useState(resolvedTopicId);
  const [activePlatform, setActivePlatform] = useState<EditorPlatform>("wechat");
  const [knowledgeReferences, setKnowledgeReferences] = useState<KnowledgeReference[]>([]);

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === activeTopicId),
    [topics, activeTopicId]
  );
  const activeContent = useMemo(
    () => contentItems.find((item) => item.topicId === activeTopicId && item.platform === "wechat"),
    [contentItems, activeTopicId]
  );
  const xiaohongshuContent = useMemo(
    () =>
      contentItems.find(
        (item) => item.topicId === activeTopicId && item.platform === "xiaohongshu"
      ) ?? null,
    [contentItems, activeTopicId]
  );
  const polishedAtByContent = useMemo(() => latestPolishByContent(versions), [versions]);

  const draft = useWechatDraft({
    initialContent,
    activeTopicId,
    activeContent,
    contentItems,
    versionCount: versions.filter((version) => version.contentItemId === activeContent?.id).length,
    upsertContent,
    addVersion,
  });
  const { fields } = draft;
  const isEvaluation = isEvaluationDraft({ topicId: activeTopicId, body: fields.body });
  const isImported = (activeContent?.source ?? fields.source) === "imported";
  const { insertedIds, insertSuggestion, resetInserted } = useIllustrationInsert(
    fields.body,
    draft.setBody
  );
  const media = useContentMedia({
    topicId: activeTopicId,
    title: fields.title,
    digest: fields.digest,
    coverCopy: fields.coverCopy,
    body: fields.body,
    isEvaluation,
    resetInserted,
  });
  const bodyInsertion = useBodyInsertion(fields.body, draft.setBody);

  const loadContent = (content: ContentItem) => {
    draft.loadContentIntoDraft(content);
    media.seedFromContent(content);
  };
  const persistDraft = (patch: DraftPatch, changeSource?: DraftChangeSource) => {
    const next = draft.persistDraft(patch, changeSource);
    media.seedFromContent(next);
    return next;
  };

  const xhs = useXiaohongshuHandoff({
    draft,
    persistDraft,
    activeTopicId,
    activeContent,
    versions,
    upsertContent,
    addVersion,
  });
  const review = useContentReview({
    draft,
    persistDraft,
    selectedTopic,
    activeTopicId,
    activeContent,
    xiaohongshuContentId: xiaohongshuContent?.id,
    reviews,
    addReview,
    targetAudience: publishVoice.audience,
  });
  const generation = useWechatGeneration({
    draft,
    persistDraft,
    selectedTopic,
    activeTopicId,
    activeContent,
    isImported,
    publishVoice,
    materials,
    knowledgeReferences,
    polishedAtByContent,
    upsertContent,
    runReview: review.runReview,
  });
  const actions = useWechatDraftActions({
    draft,
    persistDraft,
    loadContent,
    selectedTopic,
    activeTopicId,
    activeContent,
    coverSummary: media.coverSummary,
    upsertContent,
    setContentSchedule: store.setContentSchedule,
    unlockContentSchedule: store.unlockContentSchedule,
  });
  const selection = useContentSelection({
    topics,
    contentItems,
    activeContents,
    archivedContents,
    activeContent,
    setActiveTopicId,
    draft,
    loadContent,
    deleteContent: store.deleteContent,
    onSwitch: () => {
      media.resetIllustrationAnalysis();
      setActivePlatform("wechat");
      xhs.resetConversion();
      setKnowledgeReferences([]);
    },
  });

  const polishedAt = activeContent ? polishedAtByContent[activeContent.id] : undefined;

  return (
    <AppShell title="稿件 · 公众号图文">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <ContentListSidebar
          topics={topics}
          activeContents={activeContents}
          archivedContents={archivedContents}
          activeTopicId={activeTopicId}
          selectedContentIds={selection.selectedContentIds}
          scheduledJumpTargets={selection.scheduledJumpTargets}
          polishedAtByContent={polishedAtByContent}
          itemRefs={selection.topicListItemRefs}
          onSelectTopic={(topicId) => selection.selectTopic(topicId)}
          onJumpToTopic={selection.jumpToScheduledTopic}
          onToggleSelected={selection.toggleContentSelected}
          onDelete={selection.handleDeleteContents}
        />

        <div className="space-y-3">
          <WechatEditorToolbar
            platform={activePlatform}
            onPlatformChange={setActivePlatform}
            hasXiaohongshu={Boolean(xiaohongshuContent?.xiaohongshu)}
            hasDraft={Boolean(activeContent || fields.body.trim())}
            status={fields.status}
            onStatusChange={actions.changeStatus}
            source={activeContent?.source ?? fields.source}
            polishedAt={polishedAt}
            autosavePending={draft.autosavePending}
            scheduledDate={(activeContent?.scheduledAt ?? "").slice(0, 10)}
            onScheduleChange={actions.changeSchedule}
            canAutoSchedule={Boolean(
              activeContent && !isPublishedLikeStatus(activeContent.status) && !activeContent.publishedAt
            )}
            onAutoSchedule={actions.unlockSchedule}
            hasTopic={Boolean(selectedTopic)}
            hasBody={Boolean(fields.body.trim())}
            generateLoading={generation.generateLoading}
            mediaLoading={generation.wechatMediaLoading}
            mediaProgress={generation.wechatMediaProgress}
            reviewLoading={review.reviewLoading}
            onRegenerate={generation.handleRegenerateClick}
            onPublishPrepCheck={() => void generation.runPublishPrepCheck()}
            conversionPending={xhs.conversionPending}
            onConvertXiaohongshu={xhs.requestConversion}
            onDelete={
              activeContent ? () => selection.handleDeleteContents([activeContent.id]) : undefined
            }
          />

          <div className={activePlatform === "wechat" ? "space-y-3" : "hidden"}>
            <WechatDraftPanel
              draft={draft}
              media={media}
              review={review}
              generation={generation}
              actions={actions}
              bodyInsertion={bodyInsertion}
              selectedTopic={selectedTopic}
              activeContent={activeContent}
              isImported={isImported}
              isEvaluation={isEvaluation}
              targetAudience={publishVoice.audience}
              knowledgeReferences={knowledgeReferences}
              onKnowledgeReferencesChange={setKnowledgeReferences}
            />
          </div>

          <div className={activePlatform === "xiaohongshu" ? "block" : "hidden"}>
            <XiaohongshuEditor
              key={activeTopicId}
              sourceContent={xhs.sourceContentDraft}
              content={xiaohongshuContent}
              latestReview={review.latestXiaohongshuReview}
              publishVoice={publishVoice}
              conversionRequestId={xhs.conversionRequestId}
              onSave={xhs.saveXiaohongshuContent}
              onReviewSaved={addReview}
              onBackToWechat={() => setActivePlatform("wechat")}
              onConversionSuccess={() => setActivePlatform("xiaohongshu")}
              onConversionSettled={xhs.settleConversion}
            />
          </div>
        </div>
      </div>

      <RegenerateDialog
        open={generation.regenDialogOpen}
        onOpenChange={generation.setRegenDialogOpen}
        isEvaluation={isEvaluation}
        loading={generation.generateLoading}
        onRun={(mode) => void generation.runGeneration(mode)}
      />

      <IllustrationSuggestionsDialog
        open={media.illustrationDialogOpen}
        onOpenChange={media.setIllustrationDialogOpen}
        loading={media.illustrationLoading}
        summary={media.illustrationSummary}
        suggestions={media.illustrationSuggestions}
        insertedIds={insertedIds}
        onInsert={insertSuggestion}
        onRegenerate={() => void media.analyzeIllustrations({ force: true })}
      />

      <MarkdownImportDialog
        open={actions.importDialogOpen}
        onOpenChange={actions.setImportDialogOpen}
        importRaw={actions.importRaw}
        onImportRawChange={actions.setImportRaw}
        onImportText={actions.importDraft}
        onImportProject={actions.applyImportedProject}
      />
    </AppShell>
  );
}
