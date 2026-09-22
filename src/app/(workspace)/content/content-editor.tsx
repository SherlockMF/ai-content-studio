"use client";

import { ReviewIssuesPanel } from "@/components/shared/review-issues-panel";
import { reviewRevisionSignature, type ReviewRevisionDraft } from "@/lib/review-revision";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/shared/app-shell";
import { KnowledgeReferencePicker } from "@/components/shared/knowledge-reference-picker";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTENT_STATUSES,
  isPublishedLikeStatus,
  requiresPublishChecks,
  shouldStampPublishedAt,
} from "@/lib/content-status";
import { createImportBaseline, hasImportBaseline } from "@/lib/content-baseline";
import { countExportableImages } from "@/lib/export-markdown-bundle";
import { WechatPublishPanel } from "@/components/shared/wechat-publish-panel";
import { FactDiffPanel } from "@/components/shared/fact-diff-panel";
import { MarkdownImportDialog } from "@/components/shared/markdown-import-dialog";
import { XiaohongshuEditor } from "@/components/shared/xiaohongshu-editor";
import { insertMarkdownAtCursor } from "@/lib/insert-markdown-at-cursor";
import {
  formatIllustrationButtonHint,
} from "@/lib/content-media-status";
import {
  appendSupplementaryDocument,
  extractTextFromUpload,
  SUPPLEMENTARY_DOC_ACCEPT,
} from "@/lib/extract-document-text";
import { withLLMPayload } from "@/lib/ai/llm-settings";
import { isEvaluationDraft } from "@/lib/draft-profile";
import { hasText } from "@/lib/has-text";
import { parseMarkdownDraft } from "@/lib/import-markdown";
import {
  ImportedMarkdownProject,
  projectToDraftFields,
} from "@/lib/import-markdown-project";
import { formatScheduleLabel, isWeekdayDateKey } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { latestPolishByContent } from "@/lib/content-polish";
import { generateWechatMedia } from "@/lib/illustrations/wechat-media-client";
import {
  formatMediaStepToast,
  hasWechatBodyImages,
  shouldSkipDeAi,
} from "@/lib/wechat-publish-prep";
import {
  activeWechatContents,
  archivedWechatContents,
} from "@/lib/workspace-lists";
import { FactDiffReport, factSnapshotToReport, toFactSnapshot } from "@/lib/fact-diff";
import {
  analyzeReadingTime,
  formatReadingTimeBadge,
  resolveReadingProfile,
} from "@/lib/reading-time";
import { getSeedContentByTopicId } from "@/lib/seed/restore";
import { useAppStore } from "@/lib/store/app-store";
import {
  IllustrationSuggestionsDialog,
  useIllustrationInsert,
} from "@/components/shared/illustration-suggestions-dialog";
import { useContentMedia } from "@/app/(workspace)/content/hooks/use-content-media";
import { upsertCoverPlaceholder } from "@/lib/illustrations/enrich-article-media";
import {
  ContentItem,
  ContentSource,
  ContentStatus,
  KnowledgeReference,
  WechatGenerateMode,
} from "@/types/domain";

function resolveInitialTopicId(
  initialTopicId: string | null,
  orderedTopicIds: string[]
) {
  if (initialTopicId && orderedTopicIds.includes(initialTopicId)) return initialTopicId;
  return orderedTopicIds[0];
}

function sourceLabel(source: ContentSource | undefined) {
  return source === "imported" ? "已有草稿" : "AI 生成";
}

const AUTOSAVE_DELAY_MS = 700;

type DraftAutosaveState = "saved" | "pending" | "saving";

function draftFieldsEqual(
  stored: ContentItem | null | undefined,
  draft: {
    title: string;
    digest: string;
    coverCopy: string;
    body: string;
    cta: string;
    supplementaryNotes: string;
    status: ContentStatus;
    source: ContentSource;
  }
) {
  if (!stored) return false;
  return (
    stored.title === draft.title &&
    (stored.digest ?? "") === draft.digest &&
    (stored.coverCopy ?? "") === draft.coverCopy &&
    (stored.body ?? "") === draft.body &&
    (stored.cta ?? "") === draft.cta &&
    (stored.supplementaryNotes ?? "") === draft.supplementaryNotes &&
    stored.status === draft.status &&
    stored.source === draft.source
  );
}

export function ContentEditor({ initialTopicId }: { initialTopicId: string | null }) {
  const { storeHydrated } = useAppStore();
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
  const {
    topics,
    contentItems,
    upsertContent,
    deleteContent,
    setContentSchedule,
    unlockContentSchedule,
    versions,
    addVersion,
    reviews,
    addReview,
    publishVoice,
    materials,
  } = useAppStore();

  const activeContents = useMemo(
    () => activeWechatContents(contentItems),
    [contentItems]
  );
  const archivedContents = useMemo(
    () => archivedWechatContents(contentItems),
    [contentItems]
  );

  const scheduledJumpTargets = useMemo(() => {
    return activeContents
      .filter((item) => item.scheduledAt)
      .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""))
      .map((item) => ({
        topicId: item.topicId,
        scheduledAt: item.scheduledAt!,
        label: formatScheduleLabel(item.scheduledAt),
        title: item.title,
      }));
  }, [activeContents]);

  const topicListItemRefs = useRef<Record<string, HTMLElement | null>>({});

  const contentTopicIds = useMemo(() => {
    const ids = [
      ...activeContents.map((item) => item.topicId),
      ...archivedContents.map((item) => item.topicId),
      ...topics.map((topic) => topic.id),
    ];
    return [...new Set(ids)];
  }, [activeContents, archivedContents, topics]);

  const resolvedTopicId = resolveInitialTopicId(initialTopicId, contentTopicIds);
  const initialContent =
    contentItems.find(
      (item) => item.topicId === resolvedTopicId && item.platform === "wechat"
    ) ?? null;

  const [activeTopicId, setActiveTopicId] = useState(resolvedTopicId);
  const [activePlatform, setActivePlatform] = useState<"wechat" | "xiaohongshu">("wechat");
  const [xiaohongshuConversionRequestId, setXiaohongshuConversionRequestId] = useState(0);
  const [xiaohongshuConversionPending, setXiaohongshuConversionPending] = useState(false);
  const [draftTitle, setDraftTitle] = useState(initialContent?.title ?? "");
  const [draftDigest, setDraftDigest] = useState(initialContent?.digest ?? "");
  const [draftCover, setDraftCover] = useState(initialContent?.coverCopy ?? "");
  const [draftBody, setDraftBody] = useState(initialContent?.body ?? "");
  const [draftCta, setDraftCta] = useState(initialContent?.cta ?? "");
  const [draftSupplementaryNotes, setDraftSupplementaryNotes] = useState(
    initialContent?.supplementaryNotes ?? ""
  );
  const [draftSource, setDraftSource] = useState<ContentSource>(
    initialContent?.source ?? "imported"
  );
  const [draftStatus, setDraftStatus] = useState<ContentStatus>(
    initialContent?.status ?? "编辑中"
  );
  const [error, setError] = useState<string | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importRaw, setImportRaw] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [supplementaryDocLoading, setSupplementaryDocLoading] = useState(false);
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [knowledgeReferences, setKnowledgeReferences] = useState<KnowledgeReference[]>([]);
  const [factDiffReport, setFactDiffReport] = useState<FactDiffReport | null>(null);
  const [factDiffAcknowledged, setFactDiffAcknowledged] = useState(false);
  const [autosaveState, setAutosaveState] = useState<DraftAutosaveState>("saved");
  const [selectedContentIds, setSelectedContentIds] = useState<string[]>([]);
  const supplementaryFileRef = useRef<HTMLInputElement>(null);
  const bodyImageInputRef = useRef<HTMLInputElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const bodySelectionRef = useRef({ start: 0, end: 0 });
  const xiaohongshuVersionNumberRef = useRef<Record<string, number>>({});
  const suppressAutosaveRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentItemsRef = useRef(contentItems);
  const upsertContentRef = useRef(upsertContent);
  upsertContentRef.current = upsertContent;
  const draftRef = useRef({
    topicId: activeTopicId,
    title: draftTitle,
    digest: draftDigest,
    coverCopy: draftCover,
    body: draftBody,
    cta: draftCta,
    supplementaryNotes: draftSupplementaryNotes,
    status: draftStatus,
    source: draftSource,
    contentId: initialContent?.id as string | undefined,
    scheduledAt: initialContent?.scheduledAt ?? null,
    publishedAt: initialContent?.publishedAt ?? null,
    createdAt: initialContent?.createdAt as string | undefined,
    importBaseline: initialContent?.importBaseline,
    brandIconRefs: initialContent?.brandIconRefs,
    coverPromptPack: initialContent?.coverPromptPack,
    lastFactDiff: initialContent?.lastFactDiff,
    workspaceId: initialContent?.workspaceId ?? "ws_demo",
  });
  const { insertedIds, insertSuggestion, resetInserted } = useIllustrationInsert(
    draftBody,
    setDraftBody
  );

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === activeTopicId),
    [topics, activeTopicId]
  );
  const knowledgeQuery = useMemo(
    () => [
      selectedTopic?.title,
      selectedTopic?.coreViewpoint,
      selectedTopic?.painPoint,
      selectedTopic?.section,
    ].filter(Boolean).join("\n"),
    [selectedTopic]
  );
  const activeContent = useMemo(
    () =>
      contentItems.find(
        (item) => item.topicId === activeTopicId && item.platform === "wechat"
      ),
    [contentItems, activeTopicId]
  );

  contentItemsRef.current = contentItems;
  draftRef.current = {
    topicId: activeTopicId,
    title: draftTitle,
    digest: draftDigest,
    coverCopy: draftCover,
    body: draftBody,
    cta: draftCta,
    supplementaryNotes: draftSupplementaryNotes,
    status: draftStatus,
    source: draftSource,
    contentId: activeContent?.id,
    scheduledAt: activeContent?.scheduledAt ?? null,
    publishedAt: activeContent?.publishedAt ?? null,
    createdAt: activeContent?.createdAt,
    importBaseline: activeContent?.importBaseline,
    brandIconRefs: activeContent?.brandIconRefs,
    coverPromptPack: activeContent?.coverPromptPack,
    lastFactDiff: activeContent?.lastFactDiff,
    workspaceId: activeContent?.workspaceId ?? "ws_demo",
  };
  const xiaohongshuContent = useMemo(
    () =>
      contentItems.find(
        (item) => item.topicId === activeTopicId && item.platform === "xiaohongshu"
      ) ?? null,
    [contentItems, activeTopicId]
  );
  const relatedVersions = versions.filter((version) => version.contentItemId === activeContent?.id);
  const [wechatMediaLoading, setWechatMediaLoading] = useState(false);
  const [wechatMediaProgress, setWechatMediaProgress] = useState("");
  const polishedAtByContent = useMemo(() => latestPolishByContent(versions), [versions]);
  const polishedAt = activeContent ? polishedAtByContent[activeContent.id] : undefined;
  const latestReviewRecord = useMemo(() => {
    if (!activeContent?.id) return undefined;
    return [...reviews]
      .filter((review) => review.contentItemId === activeContent.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  }, [reviews, activeContent]);
  const revisionDraft: ReviewRevisionDraft = { platform: "wechat", title: draftTitle, body: draftBody, digest: draftDigest, coverCopy: draftCover, cta: draftCta };
  const reviewSignature = reviewRevisionSignature(revisionDraft, "", draftSupplementaryNotes);
  const latestReview = latestReviewRecord?.contentSnapshot === reviewSignature ? latestReviewRecord : undefined;
  const latestXiaohongshuReview = useMemo(() => {
    if (!xiaohongshuContent?.id) return undefined;
    return [...reviews]
      .filter((review) => review.contentItemId === xiaohongshuContent.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  }, [reviews, xiaohongshuContent]);
  const sourceContentDraft = useMemo<ContentItem | null>(() => {
    if (!activeTopicId) return null;
    const fallbackDate = activeContent?.createdAt ?? "1970-01-01T00:00:00.000Z";
    return {
      ...(activeContent ?? {}),
      id: activeContent?.id ?? `content_${activeTopicId}`,
      workspaceId: activeContent?.workspaceId ?? "ws_demo",
      topicId: activeTopicId,
      platform: "wechat",
      source: draftSource,
      title: draftTitle,
      digest: draftDigest,
      coverCopy: draftCover,
      body: draftBody,
      cta: draftCta,
      supplementaryNotes: draftSupplementaryNotes,
      status: draftStatus,
      createdAt: fallbackDate,
      updatedAt: activeContent?.updatedAt ?? fallbackDate,
    };
  }, [
    activeContent,
    activeTopicId,
    draftBody,
    draftCover,
    draftCta,
    draftDigest,
    draftSource,
    draftStatus,
    draftSupplementaryNotes,
    draftTitle,
  ]);
  const isImported = (activeContent?.source ?? draftSource) === "imported";
  const isEvaluation = isEvaluationDraft({ topicId: activeTopicId, body: draftBody });
  const canRestoreOriginal = hasImportBaseline(activeContent);
  const readingAnalysis = useMemo(() => {
    if (!draftBody.trim()) return null;
    const profile = resolveReadingProfile({
      isEvaluation,
      section: selectedTopic?.section,
    });
    return analyzeReadingTime(draftBody, profile);
  }, [draftBody, isEvaluation, selectedTopic?.section]);
  const illustrationHint = useMemo(
    () => formatIllustrationButtonHint(draftBody),
    [draftBody]
  );
  const media = useContentMedia({
    topicId: activeTopicId,
    title: draftTitle,
    digest: draftDigest,
    coverCopy: draftCover,
    body: draftBody,
    isEvaluation,
    resetInserted,
  });
  const exportableImages = useMemo(() => countExportableImages(draftBody), [draftBody]);
  const factBlocked = Boolean(factDiffReport?.blocking && !factDiffAcknowledged);

  const rememberBodySelection = () => {
    const el = bodyTextareaRef.current;
    if (!el) return;
    bodySelectionRef.current = { start: el.selectionStart, end: el.selectionEnd };
  };

  const insertIntoBody = (snippet: string) => {
    const { next, cursor } = insertMarkdownAtCursor(
      draftBody,
      snippet,
      bodySelectionRef.current
    );
    setDraftBody(next);
    requestAnimationFrame(() => {
      const el = bodyTextareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(cursor, cursor);
      bodySelectionRef.current = { start: cursor, end: cursor };
    });
  };

  const handleInsertBodyImage = async (file: File) => {
    setImageUploadLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload/article-image", { method: "POST", body: form });
      const data = (await res.json()) as { url?: string; message?: string };
      if (!res.ok || !data.url) throw new Error(data.message || "图片上传失败");
      const alt = file.name.replace(/\.[^.]+$/i, "") || "配图";
      insertIntoBody(`\n![${alt}](${data.url})\n`);
      toast.success("图片已插入正文，导出 Markdown 包时会一并打包");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "图片上传失败");
    } finally {
      setImageUploadLoading(false);
    }
  };

  const loadContentIntoDraft = (content: ContentItem) => {
    suppressAutosaveRef.current = true;
    setAutosaveState("saved");
    setDraftTitle(content.title);
    setDraftDigest(content.digest ?? "");
    setDraftCover(content.coverCopy ?? "");
    setDraftBody(content.body ?? "");
    setDraftCta(content.cta ?? "");
    setDraftSupplementaryNotes(content.supplementaryNotes ?? "");
    setDraftSource(content.source ?? "imported");
    setDraftStatus(content.status);
    draftRef.current = {
      ...draftRef.current,
      topicId: content.topicId,
      title: content.title,
      digest: content.digest ?? "",
      coverCopy: content.coverCopy ?? "",
      body: content.body ?? "",
      cta: content.cta ?? "",
      supplementaryNotes: content.supplementaryNotes ?? "",
      status: content.status,
      source: content.source ?? "imported",
      contentId: content.id,
      scheduledAt: content.scheduledAt ?? null,
      publishedAt: content.publishedAt ?? null,
      createdAt: content.createdAt,
      importBaseline: content.importBaseline,
      brandIconRefs: content.brandIconRefs,
      coverPromptPack: content.coverPromptPack,
      lastFactDiff: content.lastFactDiff,
      workspaceId: content.workspaceId ?? "ws_demo",
    };
    if (content.lastFactDiff) {
      setFactDiffReport(factSnapshotToReport(content.lastFactDiff));
      setFactDiffAcknowledged(Boolean(content.lastFactDiff.acknowledgedAt));
    } else {
      setFactDiffReport(null);
      setFactDiffAcknowledged(false);
    }
    if (content.coverPromptPack?.variants?.length) {
      media.seedFromGeneration({
        coverSummary: content.coverPromptPack.summary,
        coverVariants: content.coverPromptPack.variants,
        title: content.title,
        digest: content.digest ?? "",
        coverCopy: content.coverCopy ?? "",
        body: content.body,
      });
    }
  };

  const flushAutosave = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const draft = draftRef.current;
    if (!draft.topicId) return null;
    if (!draft.title.trim() && !draft.body.trim()) return null;

    const existing = contentItemsRef.current.find(
      (item) => item.topicId === draft.topicId && item.platform === "wechat"
    );
    if (
      draftFieldsEqual(existing, {
        title: draft.title,
        digest: draft.digest,
        coverCopy: draft.coverCopy,
        body: draft.body,
        cta: draft.cta,
        supplementaryNotes: draft.supplementaryNotes,
        status: draft.status,
        source: draft.source,
      })
    ) {
      setAutosaveState("saved");
      return existing ?? null;
    }

    setAutosaveState("saving");
    const now = new Date().toISOString();
    const next: ContentItem = {
      id: existing?.id ?? draft.contentId ?? `content_${draft.topicId}`,
      workspaceId: draft.workspaceId,
      topicId: draft.topicId,
      platform: "wechat",
      source: draft.source,
      title: draft.title,
      digest: draft.digest,
      coverCopy: draft.coverCopy,
      body: draft.body,
      cta: draft.cta,
      importBaseline: draft.importBaseline ?? existing?.importBaseline,
      supplementaryNotes: draft.supplementaryNotes,
      brandIconRefs: draft.brandIconRefs ?? existing?.brandIconRefs,
      coverPromptPack: draft.coverPromptPack ?? existing?.coverPromptPack,
      lastFactDiff: draft.lastFactDiff ?? existing?.lastFactDiff,
      status: draft.status,
      createdAt: draft.createdAt ?? existing?.createdAt ?? now,
      updatedAt: now,
      scheduledAt: draft.scheduledAt ?? existing?.scheduledAt ?? null,
      publishedAt: draft.publishedAt ?? existing?.publishedAt ?? null,
    };
    upsertContentRef.current(next);
    setAutosaveState("saved");
    return next;
  }, []);

  const selectTopic = (topicId: string, options?: { skipFlush?: boolean }) => {
    if (!options?.skipFlush) flushAutosave();
    resetInserted();
    media.resetIllustrationAnalysis();
    setActiveTopicId(topicId);
    setActivePlatform("wechat");
    setXiaohongshuConversionRequestId(0);
    setXiaohongshuConversionPending(false);
    setKnowledgeReferences([]);
    setFactDiffReport(null);
    setFactDiffAcknowledged(false);
    const topic = topics.find((item) => item.id === topicId);
    const content = contentItems.find(
      (item) => item.topicId === topicId && item.platform === "wechat"
    );
    if (content) {
      loadContentIntoDraft(content);
      return;
    }
    const seed = getSeedContentByTopicId(topicId);
    if (seed) {
      loadContentIntoDraft(seed);
      return;
    }
    suppressAutosaveRef.current = true;
    setAutosaveState("saved");
    setDraftTitle(topic?.title ?? "");
    setDraftDigest("");
    setDraftCover("");
    setDraftBody("");
    setDraftCta("");
    setDraftSupplementaryNotes("");
    setDraftSource("imported");
    setDraftStatus("编辑中");
  };

  const jumpToScheduledTopic = (topicId: string) => {
    selectTopic(topicId);
    requestAnimationFrame(() => {
      topicListItemRefs.current[topicId]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    });
  };

  const persistDraft = (
    patch: Partial<ContentItem> & { id: string; topicId: string },
    changeSource: "user_edit" | "ai_generate" | "ai_rewrite" | "restore" = "user_edit"
  ) => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const now = new Date().toISOString();
    const next: ContentItem = {
      id: patch.id,
      workspaceId: "ws_demo",
      topicId: patch.topicId,
      platform: "wechat",
      source: patch.source ?? draftSource,
      title: patch.title ?? draftTitle,
      digest: patch.digest ?? draftDigest,
      coverCopy: patch.coverCopy ?? draftCover,
      body: patch.body ?? draftBody,
      cta: patch.cta ?? draftCta,
      importBaseline: patch.importBaseline ?? activeContent?.importBaseline,
      supplementaryNotes: patch.supplementaryNotes ?? draftSupplementaryNotes,
      brandIconRefs: patch.brandIconRefs ?? activeContent?.brandIconRefs,
      coverPromptPack: patch.coverPromptPack ?? activeContent?.coverPromptPack,
      lastFactDiff: patch.lastFactDiff ?? activeContent?.lastFactDiff,
      status: patch.status ?? draftStatus,
      createdAt: patch.createdAt ?? activeContent?.createdAt ?? now,
      updatedAt: now,
      scheduledAt: patch.scheduledAt ?? activeContent?.scheduledAt ?? null,
      publishedAt: patch.publishedAt ?? activeContent?.publishedAt ?? null,
    };
    upsertContent(next);
    addVersion({
      id: `version_${Date.now()}`,
      contentItemId: next.id,
      versionNumber: relatedVersions.length + 1,
      title: next.title,
      body: next.body,
      digest: next.digest,
      coverCopy: next.coverCopy,
      cta: next.cta,
      supplementaryNotes: next.supplementaryNotes,
      changeSource,
      factDiffSummary: next.lastFactDiff?.summary,
      createdAt: now,
    });
    setAutosaveState("saved");
    loadContentIntoDraft(next);
    return next;
  };

  useEffect(() => {
    if (suppressAutosaveRef.current) {
      suppressAutosaveRef.current = false;
      return;
    }
    if (!activeTopicId) return;
    if (!draftTitle.trim() && !draftBody.trim()) return;
    if (
      draftFieldsEqual(activeContent, {
        title: draftTitle,
        digest: draftDigest,
        coverCopy: draftCover,
        body: draftBody,
        cta: draftCta,
        supplementaryNotes: draftSupplementaryNotes,
        status: draftStatus,
        source: draftSource,
      })
    ) {
      setAutosaveState("saved");
      return;
    }

    setAutosaveState("pending");
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      flushAutosave();
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [
    activeTopicId,
    activeContent,
    draftTitle,
    draftDigest,
    draftCover,
    draftBody,
    draftCta,
    draftSupplementaryNotes,
    draftStatus,
    draftSource,
    flushAutosave,
  ]);

  useEffect(() => {
    const onHide = () => {
      flushAutosave();
    };
    window.addEventListener("beforeunload", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("beforeunload", onHide);
      window.removeEventListener("pagehide", onHide);
      flushAutosave();
    };
  }, [flushAutosave]);

  const handleSupplementaryDocUpload = async (file: File) => {
    setSupplementaryDocLoading(true);
    try {
      const extracted = await extractTextFromUpload(file);
      if (!extracted.trim()) {
        toast.error("未能从文档中提取文字");
        return;
      }
      const merged = appendSupplementaryDocument(draftSupplementaryNotes, file.name, extracted);
      setDraftSupplementaryNotes(merged);
      if (activeContent) {
        persistDraft(
          {
            id: activeContent.id,
            topicId: activeTopicId,
            supplementaryNotes: merged,
          },
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

  const applyGenerationResult = (
    result: {
      title: string;
      digest: string;
      coverCopy: string;
      body: string;
      cta: string;
      factDiff?: FactDiffReport;
      notes?: string;
      coverSummary?: string;
      coverVariants?: Array<{
        id: string;
        styleLabel: string;
        overlayText: string;
        gptPrompt: string;
        altText: string;
        notes?: string;
      }>;
      illustrationInserted?: number;
    },
    mode: WechatGenerateMode,
    source: ContentSource
  ) => {
    const contentId = activeContent?.id ?? `content_${Date.now()}`;
    if (result.factDiff) {
      setFactDiffReport(result.factDiff);
      setFactDiffAcknowledged(!result.factDiff.blocking);
    }
    const coverPromptPack = result.coverVariants?.length
      ? { summary: result.coverSummary, variants: result.coverVariants }
      : undefined;
    const saved = persistDraft(
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
          ? toFactSnapshot(result.factDiff, result.factDiff.blocking ? undefined : new Date().toISOString())
          : undefined,
        status: mode === "from_scratch" && source === "ai" ? "AI 草稿" : draftStatus,
      },
      mode === "polish" || mode === "preserve_structure" ? "ai_rewrite" : "ai_generate"
    );
    if (coverPromptPack) {
      media.seedFromGeneration({
        coverSummary: coverPromptPack.summary,
        coverVariants: coverPromptPack.variants,
        title: result.title,
        digest: result.digest,
        coverCopy: result.coverCopy,
        body: result.body,
      });
    }
    const labels: Record<WechatGenerateMode, string> = {
      from_scratch: "已重新生成图文",
      polish: "已润色草稿",
      preserve_structure: "已润色",
    };
    const mediaHint =
      mode === "from_scratch"
        ? [
            result.illustrationInserted
              ? `正文配图 ${result.illustrationInserted} 处`
              : null,
            result.coverVariants?.length ? "封面提示词已就绪" : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : "";
    if (result.factDiff?.blocking) {
      toast.message(labels[mode], {
        description: "事实 Diff 发现关键数值变化，请确认后再标「待发布」",
      });
    } else {
      toast.success(mediaHint ? `${labels[mode]} · ${mediaHint}` : labels[mode]);
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
        title: content.title, body: content.body, previousBody,
        onProgress: setWechatMediaProgress,
        onUpdate: (body) => {
          const latest = contentItemsRef.current.find((item) => item.id === content.id);
          if (!latest || latest.body !== expectedBody ||
            (draftRef.current?.topicId === content.topicId && draftRef.current.body !== expectedBody)) {
            throw new Error("正文已变化，已停止配图更新，避免覆盖你的修改");
          }
          const next = { ...latest, body, updatedAt: new Date().toISOString() };
          expectedBody = body;
          contentItemsRef.current = contentItemsRef.current.map((item) => item.id === next.id ? next : item);
          upsertContent(next);
          if (draftRef.current?.topicId === content.topicId) {
            draftRef.current = { ...draftRef.current, body };
            setDraftBody(body);
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
    } catch (error) {
      toast.error(`文案已保存，配图未完成：${error instanceof Error ? error.message : "配图失败"}`);
      return { ok: false, failures: [error instanceof Error ? error.message : "配图失败"] };
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
    if (content.body.length > 2500) {
      toast.message("长文将分段润色，可能需要 1–2 分钟，请稍候");
    }
    const res = await fetch("/api/ai/wechat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        withLLMPayload({
          voice: publishVoice,
          materials,
          knowledgeReferences,
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
        })
      ),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "去 AI 味失败");
    if (draftRef.current?.topicId !== content.topicId || draftRef.current.body !== content.body) {
      throw new Error("稿件已切换或正文已修改，去 AI 味结果未覆盖当前内容");
    }
    return applyGenerationResult(result, mode, content.source);
  };

  /** 发布前检查：去 AI 味（可跳过）→ 补图 → 质检 */
  const runPublishPrepCheck = async () => {
    const saved = flushAutosave();
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
          polishedAt: polishedAtByContent[content.id],
        })
      ) {
        setWechatMediaProgress("已去过 AI 味，跳过");
        toast.message("已去过 AI 味，跳过");
      } else {
        setWechatMediaProgress("去 AI 味中…");
        content = await runDeAiForContent(content);
      }

      if (!hasWechatBodyImages(content.body)) {
        setWechatMediaProgress("补图：无图");
        toast.message("补图：无图");
      } else {
        await runMediaForContent(content, content.body, { manageLoading: false });
      }

      setWechatMediaProgress("质检中…");
      await runReview({ manageLoading: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发布前检查失败");
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
    setGenerateLoading(true);
    setError(null);
    setRegenDialogOpen(false);
    if (mode !== "from_scratch" && draftBody.length > 2500) {
      toast.message("长文将分段润色，可能需要 1–2 分钟，请稍候");
    }
    try {
      const res = await fetch("/api/ai/wechat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withLLMPayload({
            voice: publishVoice,
            materials,
            knowledgeReferences,
            topic: selectedTopic,
            mode,
            existingBody: mode === "from_scratch" ? undefined : draftBody,
            existingMeta: {
              title: draftTitle,
              digest: draftDigest,
              coverCopy: draftCover,
              cta: draftCta,
            },
            supplementaryNotes: draftSupplementaryNotes.trim() || undefined,
          })
        ),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "生成失败");

      const nextSource: ContentSource =
        mode === "from_scratch" ? "ai" : activeContent?.source ?? draftSource;
      if (draftRef.current?.topicId !== activeTopicId || draftRef.current.body !== draftBody) {
        throw new Error("稿件已切换或正文已修改，生成结果未覆盖当前内容");
      }
      const saved = applyGenerationResult(result, mode, nextSource);
      await runMediaForContent(saved, mode === "from_scratch" ? undefined : draftBody);
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
    if (isImported && draftBody.trim()) {
      setRegenDialogOpen(true);
      return;
    }
    void runGeneration("from_scratch");
  };

  const restoreOriginalDraft = () => {
    const baseline = activeContent?.importBaseline;
    if (!baseline?.body?.trim()) {
      toast.error("没有可恢复的原始草稿（需先导入 Markdown）");
      return;
    }
    persistDraft(
      {
        id: activeContent!.id,
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
    const title = parsed.title || selectedTopic.title;
    const digest = parsed.digest ?? draftDigest;
    const coverCopy = draftCover;
    const body = parsed.body;
    const cta = draftCta;
    const baseline = createImportBaseline({ title, body, digest, coverCopy, cta });
    const contentId = activeContent?.id ?? `content_${Date.now()}`;
    persistDraft(
      {
        id: contentId,
        topicId: selectedTopic.id,
        source: "imported",
        title,
        digest,
        coverCopy,
        body,
        cta,
        importBaseline: baseline,
        status: "编辑中",
      },
      "user_edit"
    );
    setImportDialogOpen(false);
    setImportRaw("");
    toast.success("草稿已导入");
  };

  const applyImportedProject = (project: ImportedMarkdownProject) => {
    if (!selectedTopic) {
      toast.error("请先选择选题");
      return;
    }
    const fields = projectToDraftFields(project);
    if (!fields.body.trim()) {
      toast.error("项目中没有有效正文");
      return;
    }
    const baseline = createImportBaseline({
      title: fields.title,
      body: fields.body,
      digest: fields.digest,
      coverCopy: draftCover,
      cta: draftCta,
    });
    const contentId = activeContent?.id ?? `content_${Date.now()}`;
    persistDraft(
      {
        id: contentId,
        topicId: selectedTopic.id,
        source: "imported",
        title: fields.title,
        digest: fields.digest,
        coverCopy: draftCover,
        body: fields.body,
        cta: draftCta,
        importBaseline: baseline,
        status: "编辑中",
      },
      "user_edit"
    );
    setImportDialogOpen(false);
    setImportRaw("");
    toast.success(
      `项目已导入：${project.uploadedImages} 张图片已上传${
        project.skippedImages > 0 ? `，${project.skippedImages} 处未匹配` : ""
      }`
    );
  };

  const runReview = async (options?: { manageLoading?: boolean }) => {
    const start = draftRef.current;
    if (!start.body.trim()) {
      toast.error("请先填写正文");
      return;
    }
    if (!selectedTopic) {
      toast.error("请先选择选题");
      return;
    }

    let contentId = activeContent?.id ?? start.contentId;
    if (!contentId) {
      const saved = persistDraft(
        {
          id: `content_${Date.now()}`,
          topicId: activeTopicId,
          source: draftSource,
          status: draftStatus,
        },
        "user_edit"
      );
      contentId = saved.id;
    }

    const startSignature = reviewRevisionSignature(
      {
        platform: "wechat",
        title: start.title,
        body: start.body,
        digest: start.digest,
        coverCopy: start.coverCopy,
        cta: start.cta,
      },
      "",
      start.supplementaryNotes
    );

    const manageLoading = options?.manageLoading !== false;
    if (manageLoading) setReviewLoading(true);
    try {
      const res = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withLLMPayload({
            title: start.title,
            body: start.body,
            targetAudience: publishVoice.audience,
            supplementaryNotes: start.supplementaryNotes.trim() || undefined,
          })
        ),
      });
      const review = await res.json();
      if (!res.ok) throw new Error(review.message || "质检失败");
      const issues = Array.isArray(review.issues) ? review.issues : [];
      const score = typeof review.score === "number" ? review.score : 0;
      const current = draftRef.current;
      const currentSignature = reviewRevisionSignature(
        {
          platform: "wechat",
          title: current.title,
          body: current.body,
          digest: current.digest,
          coverCopy: current.coverCopy,
          cta: current.cta,
        },
        "",
        current.supplementaryNotes
      );
      if (current.topicId !== activeTopicId || currentSignature !== startSignature) {
        toast.message("稿件已变化，本次质检结果未应用，请重新质检");
        return;
      }
      addReview({
          id: `review_${Date.now()}`,
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

  const saveXiaohongshuContent = (
    content: ContentItem,
    changeSource: "ai_generate" | "user_edit" | "ai_rewrite"
  ) => {
    const now = new Date().toISOString();
    const persistedVersionNumber =
      versions
        .filter((version) => version.contentItemId === content.id)
        .reduce((highest, version) => Math.max(highest, version.versionNumber), 0);
    const versionNumber =
      Math.max(
        persistedVersionNumber,
        xiaohongshuVersionNumberRef.current[content.id] ?? 0
      ) + 1;
    xiaohongshuVersionNumberRef.current[content.id] = versionNumber;
    upsertContent(content);
    addVersion({
      id: `version_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      contentItemId: content.id,
      versionNumber,
      title: content.title,
      body: content.body,
      digest: content.digest,
      coverCopy: content.coverCopy,
      cta: content.cta,
      supplementaryNotes: content.supplementaryNotes,
      changeSource,
      xiaohongshu: content.xiaohongshu,
      createdAt: now,
    });
  };

  const requestXiaohongshuConversion = () => {
    if (xiaohongshuConversionPending) return;
    if (!sourceContentDraft || !hasText(sourceContentDraft.body)) {
      toast.error("请先填写公众号正文");
      return;
    }
    if (!activeContent) {
      persistDraft(
        {
          id: sourceContentDraft.id,
          topicId: sourceContentDraft.topicId,
          source: sourceContentDraft.source,
          status: sourceContentDraft.status,
        },
        "user_edit"
      );
    }
    setXiaohongshuConversionPending(true);
    setXiaohongshuConversionRequestId((requestId) => requestId + 1);
  };

  const hasDraft = Boolean(activeContent || draftBody.trim());

  const toggleContentSelected = (contentId: string, checked: boolean) => {
    setSelectedContentIds((current) => {
      if (checked) return current.includes(contentId) ? current : [...current, contentId];
      return current.filter((id) => id !== contentId);
    });
  };

  const handleDeleteContents = (ids: string[]) => {
    if (ids.length === 0) return;
    const label =
      ids.length === 1
        ? "删除这篇稿件？同选题下的小红书稿也会一起删除，剩余稿排期会自动顺延。"
        : `删除选中的 ${ids.length} 篇稿件？关联平台稿会一并删除，剩余排期自动顺延。`;
    if (!window.confirm(label)) return;
    const removingActive = ids.includes(activeContent?.id ?? "");
    const remaining = activeContents.filter((item) => !ids.includes(item.id));
    if (removingActive) {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      suppressAutosaveRef.current = true;
    }
    deleteContent(ids);
    setSelectedContentIds((current) => current.filter((id) => !ids.includes(id)));
    toast.success(ids.length === 1 ? "稿件已删除，剩余排期已顺延" : `已删除 ${ids.length} 篇，剩余排期已顺延`);
    if (removingActive) {
      if (remaining[0]) {
        selectTopic(remaining[0].topicId, { skipFlush: true });
      } else if (archivedContents[0]) {
        selectTopic(archivedContents[0].topicId, { skipFlush: true });
      } else {
        suppressAutosaveRef.current = true;
        setDraftTitle("");
        setDraftDigest("");
        setDraftCover("");
        setDraftBody("");
        setDraftCta("");
        setDraftSupplementaryNotes("");
        setDraftStatus("编辑中");
      }
    }
  };

  const handleScheduleChange = (dateKey: string) => {
    if (!activeContent) {
      toast.error("请先保存稿件再设置排期");
      return;
    }
    const nextKey = dateKey.trim() || null;
    if (nextKey && !isWeekdayDateKey(nextKey)) {
      toast.message("所选日期不是工作日，仍按手动日期保存");
    }
    setContentSchedule(activeContent.id, nextKey, { cascade: true });
    toast.success(nextKey ? `排期已手动锁定为 ${formatScheduleLabel(nextKey)}` : "已取消并锁定为不排期");
  };

  return (
    <AppShell title="稿件 · 公众号图文">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-hidden">
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">稿件列表</CardTitle>
                <p className="mt-1 text-xs text-slate-500">勾选可批量删除；手动日期会保留</p>
              </div>
              {selectedContentIds.length > 0 ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="h-7 shrink-0 text-xs"
                  onClick={() => handleDeleteContents(selectedContentIds)}
                >
                  删除 {selectedContentIds.length}
                </Button>
              ) : null}
            </div>
            {scheduledJumpTargets.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[11px] text-slate-500">按排期日定位</p>
                <div className="flex flex-wrap gap-1.5">
                  {scheduledJumpTargets.map((item) => {
                    const active = item.topicId === activeTopicId;
                    return (
                      <button
                        key={`${item.topicId}-${item.scheduledAt}`}
                        type="button"
                        title={item.title}
                        onClick={() => jumpToScheduledTopic(item.topicId)}
                        className={cn(
                          "rounded-md border px-2 py-1 text-[11px] leading-none transition",
                          active
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900"
                        )}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="max-h-[min(70vh,calc(100vh-12rem))] space-y-2 overflow-y-auto">
            {activeContents.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-slate-500">
                暂无进行中的稿件。可从选题页「去写稿」。
              </p>
            ) : (
              activeContents.map((content) => {
                const topic = topics.find((item) => item.id === content.topicId);
                const checked = selectedContentIds.includes(content.id);
                return (
                  <div
                    key={content.id}
                    ref={(node) => {
                      topicListItemRefs.current[content.topicId] = node;
                    }}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border px-2 py-2 text-sm hover:bg-slate-50",
                      activeTopicId === content.topicId && "border-slate-900"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        toggleContentSelected(content.id, value === true)
                      }
                      className="mt-1"
                      aria-label={`选择 ${content.title || topic?.title || "稿件"}`}
                    />
                    <button
                      type="button"
                      onClick={() => selectTopic(content.topicId)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block font-medium">{content.title || topic?.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {content.scheduledAt ? (
                          <span className="font-medium text-sky-700">
                            {formatScheduleLabel(content.scheduledAt)}
                          </span>
                        ) : (
                          <span>未排期</span>
                        )}
                        {topic ? <span>{topic.section}</span> : null}
                        <Badge variant="secondary" className="text-[10px]">
                          {content.status}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {sourceLabel(content.source)}
                        </Badge>
                        {polishedAtByContent[content.id] ? (
                          <Badge variant="outline" className="text-[10px] text-emerald-700">
                            已 AI 润色
                          </Badge>
                        ) : null}
                      </span>
                    </button>
                  </div>
                );
              })
            )}

            {archivedContents.length > 0 ? (
              <details className="rounded-lg border border-dashed px-3 py-2">
                <summary className="cursor-pointer text-xs font-medium text-slate-500">
                  已归档 {archivedContents.length}
                </summary>
                <div className="mt-2 space-y-2">
                  {archivedContents.map((content) => {
                    const topic = topics.find((item) => item.id === content.topicId);
                    return (
                      <button
                        key={content.id}
                        type="button"
                        ref={(node) => {
                          topicListItemRefs.current[content.topicId] = node;
                        }}
                        onClick={() => selectTopic(content.topicId)}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 ${
                          activeTopicId === content.topicId ? "border-slate-900" : ""
                        }`}
                      >
                        <span className="block font-medium">{content.title || topic?.title}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {content.scheduledAt ? (
                            <span>{formatScheduleLabel(content.scheduledAt)}</span>
                          ) : null}
                          <Badge variant="outline" className="text-[10px]">
                            已归档
                          </Badge>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </details>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
            <div className="flex rounded-md bg-slate-100 p-0.5">
              <Button
                size="sm"
                className="h-7 px-2.5 text-xs"
                variant={activePlatform === "wechat" ? "default" : "ghost"}
                onClick={() => setActivePlatform("wechat")}
              >
                公众号
              </Button>
              <Button
                size="sm"
                className="h-7 px-2.5 text-xs"
                variant={activePlatform === "xiaohongshu" ? "default" : "ghost"}
                onClick={() => setActivePlatform("xiaohongshu")}
              >
                小红书
                {xiaohongshuContent?.xiaohongshu ? " · 已有" : ""}
              </Button>
            </div>
            {activePlatform === "wechat" && hasDraft ? (
              <>
                <Select
                  value={draftStatus}
                  onValueChange={(value) => {
                    const target = value as ContentStatus;
                    if (requiresPublishChecks(target) && factBlocked) {
                      toast.error("事实 Diff 未确认，不能标记为待发布/已发布");
                      return;
                    }
                    setDraftStatus(target);
                    if (!activeContent) return;
                    const publishedAt = shouldStampPublishedAt(target)
                      ? activeContent.publishedAt ?? new Date().toISOString()
                      : activeContent.publishedAt;
                    upsertContent({
                      ...activeContent,
                      status: target,
                      publishedAt,
                      updatedAt: new Date().toISOString(),
                    });
                    toast.success(`状态已更新为 ${target}`);
                  }}
                >
                  <SelectTrigger className="h-7 w-[7.5rem] text-xs">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant={isImported ? "outline" : "secondary"} className="text-[10px]">
                  {sourceLabel(activeContent?.source ?? draftSource)}
                </Badge>
                {polishedAt ? (
                  <Badge variant="outline" className="text-[10px] text-emerald-700"
                    title={`最近润色：${new Date(polishedAt).toLocaleString()}`}>
                    已 AI 润色
                  </Badge>
                ) : null}
                <span
                  className={cn(
                    "text-[11px]",
                    autosaveState === "saved"
                      ? "text-slate-500"
                      : autosaveState === "saving"
                        ? "text-sky-600"
                        : "text-amber-600"
                  )}
                >
                  {autosaveState === "saved"
                    ? "已自动保存"
                    : autosaveState === "saving"
                      ? "保存中…"
                      : "待自动保存"}
                </span>
              </>
            ) : null}
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {activePlatform === "wechat" ? (
                <>
                  {hasDraft ? (
                    <>
                    <Input
                      type="date"
                      value={(activeContent?.scheduledAt ?? "").slice(0, 10)}
                      onChange={(e) => handleScheduleChange(e.target.value)}
                      className="h-7 w-[9.5rem] text-xs"
                      title="设置并锁定排期，自动规划会保留手动日期"
                    />
                    {activeContent && !isPublishedLikeStatus(activeContent.status) && !activeContent.publishedAt ? <Button size="sm" variant="outline" onClick={() => { unlockContentSchedule(activeContent.id); toast.success("已纳入自动排期"); }}>自动安排日期</Button> : null}
                    </>
                  ) : null}
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={!selectedTopic || generateLoading || wechatMediaLoading}
                    onClick={handleRegenerateClick}
                  >
                    {generateLoading
                      ? wechatMediaProgress || "润色处理中…"
                      : isImported
                        ? polishedAt ? "再次润色" : "AI 润色"
                        : "重新生成"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    title="去 AI 味 → 补图 → 质检"
                    disabled={!draftBody.trim() || generateLoading || wechatMediaLoading || reviewLoading}
                    onClick={() => void runPublishPrepCheck()}
                  >
                    {wechatMediaLoading
                      ? wechatMediaProgress || "发布前检查中…"
                      : "发布前检查"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={!draftBody.trim() || xiaohongshuConversionPending}
                    onClick={requestXiaohongshuConversion}
                  >
                    {xiaohongshuConversionPending
                      ? "转换中…"
                      : xiaohongshuContent?.xiaohongshu
                        ? "更新小红书"
                        : "转小红书"}
                  </Button>
                  {activeContent ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs text-red-600 hover:text-red-700"
                      onClick={() => handleDeleteContents([activeContent.id])}
                    >
                      删除
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>

          <div className={activePlatform === "wechat" ? "space-y-3" : "hidden"}>
          {error ? <ErrorState message={error} /> : null}

          <Card>
            <CardContent className="space-y-3 pt-4">
              {!hasDraft ? (
                <EmptyState
                  title="暂无稿件"
                  description="可导入已有 Markdown 测评稿，或在选题页通过热点流程 AI 生成。"
                />
              ) : null}

              {hasDraft ? (
                <>
                  <div className="space-y-2">
                    <Input
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      placeholder="标题"
                      className="h-11 border-0 bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        value={draftDigest}
                        onChange={(e) => setDraftDigest(e.target.value)}
                        placeholder="摘要"
                        className="h-8 text-sm"
                      />
                      <Input
                        value={draftCover}
                        onChange={(e) => setDraftCover(e.target.value)}
                        placeholder="封面短文案"
                        className="h-8 text-sm"
                      />
                    </div>
                    {readingAnalysis ? (
                      <p className="text-[11px] text-slate-500" title={readingAnalysis.guidance}>
                        <span className="font-medium text-slate-700">
                          {formatReadingTimeBadge(readingAnalysis)}
                        </span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span>{readingAnalysis.charCount} 字</span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span>{readingAnalysis.profileLabel}</span>
                      </p>
                    ) : null}
                  </div>

                  <Textarea
                    ref={bodyTextareaRef}
                    value={draftBody}
                    onSelect={rememberBodySelection}
                    onKeyUp={rememberBodySelection}
                    onClick={rememberBodySelection}
                    onChange={(e) => {
                      rememberBodySelection();
                      setDraftBody(e.target.value);
                    }}
                    className="field-sizing-fixed min-h-[min(58vh,36rem)] resize-y overflow-y-auto font-mono text-sm leading-relaxed"
                    placeholder="正文 Markdown（测评结构、数据、章节请写在这里）"
                  />

                  <input
                    ref={bodyImageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      await handleInsertBodyImage(file);
                      event.target.value = "";
                    }}
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        flushAutosave();
                        toast.success("草稿已保存");
                      }}
                    >
                      立即保存
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!draftBody.trim() || media.illustrationLoading}
                      onClick={() => void media.analyzeIllustrations()}
                    >
                      {media.illustrationLoading
                        ? "分析中..."
                        : media.hasIllustrationCache
                          ? `查看配图建议${illustrationHint ? ` ${illustrationHint}` : ""}`
                          : `识别正文配图${illustrationHint ? ` ${illustrationHint}` : ""}`}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        media.coverLoading || (!draftTitle.trim() && !draftBody.trim())
                      }
                      onClick={() => {
                        void (async () => {
                          if (!selectedTopic) {
                            toast.error("请先选择选题");
                            return;
                          }
                          const variant = await media.analyzeCover({ force: true });
                          if (!variant) return;
                          const nextBody = upsertCoverPlaceholder(draftBody, variant);
                          const nextCover =
                            !draftCover.trim() && variant.overlayText.trim()
                              ? variant.overlayText.trim()
                              : draftCover;
                          setDraftBody(nextBody);
                          if (nextCover !== draftCover) setDraftCover(nextCover);
                          persistDraft(
                            {
                              id: activeContent?.id ?? `content_${Date.now()}`,
                              topicId: activeTopicId,
                              body: nextBody,
                              coverCopy: nextCover,
                              coverPromptPack: {
                                summary: media.coverSummary,
                                variants: [variant],
                              },
                            },
                            "ai_generate"
                          );
                          toast.success("封面提示词已写入正文开头");
                        })();
                      }}
                    >
                      {media.coverLoading
                        ? "生成中..."
                        : media.hasCoverCache
                          ? "更新封面提示词"
                          : "生成封面提示词"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={imageUploadLoading}
                      onClick={() => bodyImageInputRef.current?.click()}
                    >
                      {imageUploadLoading ? "上传中..." : "插入本地图片"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!draftBody.trim() || reviewLoading || wechatMediaLoading}
                      onClick={() => void runReview()}
                    >
                      {reviewLoading ? "质检中..." : "运行质检"}
                    </Button>
                  </div>

                  <details className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700">
                      更多操作与资料
                    </summary>
                    <div className="mt-3 space-y-3">
                      <p className="text-xs text-slate-500">
                        {isImported
                          ? isEvaluation
                            ? "测评稿以你的测试过程与数据为准；AI 仅做润色，不会默认整篇重写。"
                            : "已有草稿以你的正文为准；AI 仅做润色，不会默认整篇重写。"
                          : "AI 生成稿会在出稿时自动去 AI 味。"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!selectedTopic}
                          onClick={() => setImportDialogOpen(true)}
                        >
                          导入 Markdown
                        </Button>
                        {canRestoreOriginal ? (
                          <Button variant="outline" size="sm" onClick={restoreOriginalDraft}>
                            恢复原始草稿
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!activeContent}
                          onClick={() => {
                            if (autosaveTimerRef.current) {
                              clearTimeout(autosaveTimerRef.current);
                              autosaveTimerRef.current = null;
                            }
                            if (activeContent) loadContentIntoDraft(activeContent);
                          }}
                        >
                          放弃未保存修改
                        </Button>
                      </div>
                      {selectedTopic ? (
                        <KnowledgeReferencePicker
                          query={knowledgeQuery}
                          value={knowledgeReferences}
                          onChange={setKnowledgeReferences}
                          compact
                        />
                      ) : null}
                      <div className="space-y-2 rounded-lg border border-amber-100 bg-amber-50/40 p-3">
                        <p className="text-sm font-medium text-slate-700">补充信息</p>
                        <p className="text-xs text-slate-500">
                          模型实名、测试条件等；也可上传文档，AI 润色与质检时会融入。
                        </p>
                        <input
                          ref={supplementaryFileRef}
                          type="file"
                          accept={SUPPLEMENTARY_DOC_ACCEPT}
                          className="hidden"
                          onChange={async (event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            await handleSupplementaryDocUpload(file);
                            event.target.value = "";
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={supplementaryDocLoading}
                          onClick={() => supplementaryFileRef.current?.click()}
                        >
                          {supplementaryDocLoading ? "解析中…" : "上传补充文档"}
                        </Button>
                        <Textarea
                          value={draftSupplementaryNotes}
                          onChange={(e) => setDraftSupplementaryNotes(e.target.value)}
                          rows={4}
                          placeholder="例如：Cola-A 现为 August（Qwen 3.8 Flash）…"
                          className="font-mono text-sm leading-relaxed"
                        />
                      </div>
                    </div>
                  </details>

                  <FactDiffPanel
                    report={factDiffReport}
                    acknowledged={factDiffAcknowledged}
                    onAcknowledge={() => {
                      setFactDiffAcknowledged(true);
                      if (activeContent && factDiffReport) {
                        persistDraft(
                          {
                            id: activeContent.id,
                            topicId: activeTopicId,
                            lastFactDiff: toFactSnapshot(
                              factDiffReport,
                              new Date().toISOString()
                            ),
                          },
                          "user_edit"
                        );
                      }
                      toast.success("已确认事实 Diff，可标记待发布");
                    }}
                  />

                  <WechatPublishPanel
                    title={draftTitle}
                    digest={draftDigest}
                    body={draftBody}
                    reviewScore={latestReview?.score}
                    exportableLocalImages={exportableImages.local}
                    placeholderImages={exportableImages.placeholder}
                    factDiff={factDiffReport}
                    factDiffAcknowledged={factDiffAcknowledged}
                  />

                  {latestReviewRecord ? (
                    <ReviewIssuesPanel key={latestReviewRecord.id} review={latestReviewRecord}
                      draft={revisionDraft} supplementaryNotes={draftSupplementaryNotes}
                      targetAudience={publishVoice.audience} stale={!latestReview}
                      disabled={reviewLoading || generateLoading || wechatMediaLoading}
                      onApply={(revised) => {
                        if (!activeContent) return;
                        persistDraft({ id: activeContent.id, topicId: activeTopicId,
                          title: revised.title, body: revised.body, digest: revised.digest,
                          coverCopy: revised.coverCopy, cta: revised.cta, status: "编辑中" }, "ai_rewrite");
                      }} />
                  ) : null}
                </>
              ) : null}
            </CardContent>
          </Card>
          </div>

          <div className={activePlatform === "xiaohongshu" ? "block" : "hidden"}>
            <XiaohongshuEditor
              key={activeTopicId}
              sourceContent={sourceContentDraft}
              content={xiaohongshuContent}
              latestReview={latestXiaohongshuReview}
              publishVoice={publishVoice}
              conversionRequestId={xiaohongshuConversionRequestId}
              onSave={saveXiaohongshuContent}
              onReviewSaved={addReview}
              onBackToWechat={() => setActivePlatform("wechat")}
              onConversionSuccess={() => setActivePlatform("xiaohongshu")}
              onConversionSettled={() => setXiaohongshuConversionPending(false)}
            />
          </div>
        </div>
      </div>

      <Dialog open={regenDialogOpen} onOpenChange={setRegenDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>如何处理已有草稿？</DialogTitle>
            <DialogDescription>
              {isEvaluation
                ? "检测到测评型正文。默认只做润色，不会整篇覆盖。"
                : "默认只做润色，保留你的正文。从零重写会丢失现有内容。"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button disabled={generateLoading} onClick={() => void runGeneration("polish")}>
              润色去 AI 味
            </Button>
            {isEvaluation ? (
              <Button
                variant="secondary"
                disabled={generateLoading}
                onClick={() => void runGeneration("preserve_structure")}
              >
                优化表达
              </Button>
            ) : null}
            <Button
              variant="outline"
              disabled={generateLoading}
              onClick={() => {
                if (
                  !window.confirm(
                    isEvaluation
                      ? "从零重写将丢弃当前正文中的测评细节与数据，确定继续？"
                      : "从零重写将丢弃当前正文，确定继续？"
                  )
                ) {
                  return;
                }
                void runGeneration("from_scratch");
              }}
            >
              从零重写
            </Button>
          </div>
          <DialogFooter />
        </DialogContent>
      </Dialog>

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
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        importRaw={importRaw}
        onImportRawChange={setImportRaw}
        onImportText={importDraft}
        onImportProject={applyImportedProject}
      />
    </AppShell>
  );
}
