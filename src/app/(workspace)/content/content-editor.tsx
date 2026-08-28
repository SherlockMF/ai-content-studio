"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/shared/app-shell";
import { KnowledgeReferencePicker } from "@/components/shared/knowledge-reference-picker";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { CONTENT_STATUSES } from "@/lib/content-status";
import { createImportBaseline, hasImportBaseline } from "@/lib/content-baseline";
import {
  buildArticleMarkdown,
  buildMarkdownZipBundle,
  countExportableImages,
} from "@/lib/export-markdown-bundle";
import { buildWechatDocxBundle } from "@/lib/export-wechat-docx";
import { insertMarkdownAtCursor } from "@/lib/insert-markdown-at-cursor";
import {
  formatCoverStatusHint,
  formatIllustrationButtonHint,
} from "@/lib/content-media-status";
import {
  appendSupplementaryDocument,
  extractTextFromUpload,
  SUPPLEMENTARY_DOC_ACCEPT,
} from "@/lib/extract-document-text";
import { withLLMPayload } from "@/lib/ai/llm-settings";
import { isEvaluationDraft } from "@/lib/draft-profile";
import { parseMarkdownDraft } from "@/lib/import-markdown";
import {
  analyzeReadingTime,
  formatReadingTimeBadge,
  resolveReadingProfile,
} from "@/lib/reading-time";
import { getSeedContentByTopicId, isSeedTopicId } from "@/lib/seed/restore";
import { useAppStore } from "@/lib/store/app-store";
import {
  IllustrationSuggestionsDialog,
  useIllustrationInsert,
} from "@/components/shared/illustration-suggestions-dialog";
import { CoverSuggestionsDialog } from "@/components/shared/cover-suggestions-dialog";
import { IllustrationSuggestion } from "@/lib/illustrations/insert";
import { CoverImageVariant } from "@/lib/illustrations/cover";
import { ContentItem, ContentSource, ContentStatus, KnowledgeReference, WechatGenerateMode } from "@/types/domain";

function resolveInitialTopicId(initialTopicId: string | null, topicIds: string[]) {
  if (initialTopicId && topicIds.includes(initialTopicId)) return initialTopicId;
  return topicIds[0];
}

function sourceLabel(source: ContentSource | undefined) {
  return source === "imported" ? "已有草稿" : "AI 生成";
}

function buildCoverSourceKey(input: {
  topicId: string;
  title: string;
  digest: string;
  coverCopy: string;
  body: string;
}) {
  return [
    input.topicId,
    input.title.trim(),
    input.digest.trim(),
    input.coverCopy.trim(),
    input.body.length,
    input.body.slice(0, 800),
  ].join("|");
}

function buildIllustrationSourceKey(input: {
  topicId: string;
  title: string;
  body: string;
}) {
  return [input.topicId, input.title.trim(), input.body.length, input.body.slice(0, 1200)].join(
    "|"
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
    versions,
    addVersion,
    reviews,
    setReviews,
    publishVoice,
    materials,
  } = useAppStore();

  const resolvedTopicId = resolveInitialTopicId(
    initialTopicId,
    topics.map((topic) => topic.id)
  );
  const initialContent =
    contentItems.find(
      (item) => item.topicId === resolvedTopicId && item.platform === "wechat"
    ) ?? null;

  const [activeTopicId, setActiveTopicId] = useState(resolvedTopicId);
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
  const [illustrationDialogOpen, setIllustrationDialogOpen] = useState(false);
  const [illustrationLoading, setIllustrationLoading] = useState(false);
  const [illustrationSummary, setIllustrationSummary] = useState<string>();
  const [illustrationSuggestions, setIllustrationSuggestions] = useState<IllustrationSuggestion[]>(
    []
  );
  const [coverDialogOpen, setCoverDialogOpen] = useState(false);
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverSummary, setCoverSummary] = useState<string>();
  const [coverVariants, setCoverVariants] = useState<CoverImageVariant[]>([]);
  const [coverCacheKey, setCoverCacheKey] = useState<string | null>(null);
  const [illustrationCacheKey, setIllustrationCacheKey] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [supplementaryDocLoading, setSupplementaryDocLoading] = useState(false);
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [exportBundleLoading, setExportBundleLoading] = useState(false);
  const [exportWechatDocxLoading, setExportWechatDocxLoading] = useState(false);
  const [knowledgeReferences, setKnowledgeReferences] = useState<KnowledgeReference[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supplementaryFileRef = useRef<HTMLInputElement>(null);
  const bodyImageInputRef = useRef<HTMLInputElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const bodySelectionRef = useRef({ start: 0, end: 0 });
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
  const relatedVersions = versions.filter((version) => version.contentItemId === activeContent?.id);
  const latestReview = useMemo(() => {
    if (!activeContent?.id) return undefined;
    return [...reviews]
      .filter((review) => review.contentItemId === activeContent.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  }, [reviews, activeContent]);
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
  const coverStatusHint = useMemo(
    () => formatCoverStatusHint(draftBody, draftCover),
    [draftBody, draftCover]
  );
  const coverSourceKey = useMemo(
    () =>
      buildCoverSourceKey({
        topicId: activeTopicId,
        title: draftTitle,
        digest: draftDigest,
        coverCopy: draftCover,
        body: draftBody,
      }),
    [activeTopicId, draftTitle, draftDigest, draftCover, draftBody]
  );
  const illustrationSourceKey = useMemo(
    () =>
      buildIllustrationSourceKey({
        topicId: activeTopicId,
        title: draftTitle,
        body: draftBody,
      }),
    [activeTopicId, draftTitle, draftBody]
  );
  const hasCoverCache =
    coverVariants.length > 0 && coverCacheKey !== null && coverCacheKey === coverSourceKey;
  const hasIllustrationCache =
    illustrationSuggestions.length > 0 &&
    illustrationCacheKey !== null &&
    illustrationCacheKey === illustrationSourceKey;
  const exportableImages = useMemo(() => countExportableImages(draftBody), [draftBody]);

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

  const resetCoverAnalysis = () => {
    setCoverVariants([]);
    setCoverSummary(undefined);
    setCoverCacheKey(null);
  };

  const resetIllustrationAnalysis = () => {
    setIllustrationSuggestions([]);
    setIllustrationSummary(undefined);
    setIllustrationCacheKey(null);
    resetInserted();
  };

  const loadContentIntoDraft = (content: ContentItem) => {
    setDraftTitle(content.title);
    setDraftDigest(content.digest ?? "");
    setDraftCover(content.coverCopy ?? "");
    setDraftBody(content.body);
    setDraftCta(content.cta ?? "");
    setDraftSupplementaryNotes(content.supplementaryNotes ?? "");
    setDraftSource(content.source ?? "imported");
    setDraftStatus(content.status);
  };

  const selectTopic = (topicId: string) => {
    resetInserted();
    resetCoverAnalysis();
    resetIllustrationAnalysis();
    setActiveTopicId(topicId);
    setKnowledgeReferences([]);
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
    setDraftTitle(topic?.title ?? "");
    setDraftDigest("");
    setDraftCover("");
    setDraftBody("");
    setDraftCta("");
    setDraftSupplementaryNotes("");
    setDraftSource("imported");
    setDraftStatus("编辑中");
  };

  const persistDraft = (
    patch: Partial<ContentItem> & { id: string; topicId: string },
    changeSource: "user_edit" | "ai_generate" | "ai_rewrite" | "restore" = "user_edit"
  ) => {
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
      changeSource,
      createdAt: now,
    });
    loadContentIntoDraft(next);
    return next;
  };

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
    },
    mode: WechatGenerateMode,
    source: ContentSource
  ) => {
    const contentId = activeContent?.id ?? `content_${Date.now()}`;
    persistDraft(
      {
        id: contentId,
        topicId: activeTopicId,
        source,
        title: result.title,
        digest: result.digest,
        coverCopy: result.coverCopy,
        body: result.body,
        cta: result.cta,
        status: source === "ai" ? "AI 草稿" : draftStatus === "待发布" ? "待发布" : "编辑中",
      },
      mode === "polish" || mode === "preserve_structure" ? "ai_rewrite" : "ai_generate"
    );
    const labels: Record<WechatGenerateMode, string> = {
      from_scratch: "已重新生成图文（已自动去 AI 味）",
      polish: "已润色草稿（保留测评结构与数据）",
      preserve_structure: "已在保留结构前提下润色",
    };
    toast.success(labels[mode]);
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
      applyGenerationResult(result, mode, nextSource);
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

  const analyzeIllustrations = async (options?: { force?: boolean }) => {
    if (illustrationLoading) return;
    if (!draftBody.trim()) {
      toast.error("请先填写正文");
      return;
    }
    const cached =
      !options?.force &&
      illustrationSuggestions.length > 0 &&
      illustrationCacheKey !== null &&
      illustrationCacheKey === illustrationSourceKey;
    if (cached) {
      setIllustrationDialogOpen(true);
      return;
    }
    setIllustrationDialogOpen(true);
    setIllustrationLoading(true);
    if (options?.force) {
      setIllustrationSummary(undefined);
      setIllustrationSuggestions([]);
      resetInserted();
    }
    try {
      const res = await fetch("/api/ai/illustrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withLLMPayload({
            title: draftTitle,
            body: draftBody,
            topicId: activeTopicId,
            isEvaluation,
          })
        ),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "配图分析失败");
      setIllustrationSummary(result.summary);
      setIllustrationSuggestions(result.suggestions ?? []);
      setIllustrationCacheKey(illustrationSourceKey);
      if (!result.suggestions?.length) {
        toast.message("未找到合适的配图位置");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "配图分析失败");
      setIllustrationDialogOpen(false);
    } finally {
      setIllustrationLoading(false);
    }
  };

  const analyzeCover = async (options?: { force?: boolean }) => {
    if (coverLoading) return;
    if (!draftTitle.trim() && !draftBody.trim()) {
      toast.error("请先填写标题或正文");
      return;
    }
    const cached =
      !options?.force &&
      coverVariants.length > 0 &&
      coverCacheKey !== null &&
      coverCacheKey === coverSourceKey;
    if (cached) {
      setCoverDialogOpen(true);
      return;
    }
    setCoverDialogOpen(true);
    setCoverLoading(true);
    if (options?.force) {
      setCoverSummary(undefined);
      setCoverVariants([]);
    }
    try {
      const res = await fetch("/api/ai/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withLLMPayload({
            title: draftTitle,
            digest: draftDigest,
            coverCopy: draftCover,
            body: draftBody,
            topicId: activeTopicId,
            isEvaluation,
          })
        ),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "封面图分析失败");
      setCoverSummary(result.summary);
      setCoverVariants(result.variants ?? []);
      setCoverCacheKey(coverSourceKey);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "封面图分析失败");
      setCoverDialogOpen(false);
    } finally {
      setCoverLoading(false);
    }
  };

  const runReview = async () => {
    if (!draftBody.trim()) {
      toast.error("请先填写正文");
      return;
    }
    if (!selectedTopic) {
      toast.error("请先选择选题");
      return;
    }

    let contentId = activeContent?.id;
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

    setReviewLoading(true);
    try {
      const res = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withLLMPayload({
            title: draftTitle,
            body: draftBody,
            targetAudience: publishVoice.audience,
            supplementaryNotes: draftSupplementaryNotes.trim() || undefined,
          })
        ),
      });
      const review = await res.json();
      if (!res.ok) throw new Error(review.message || "质检失败");
      const issues = Array.isArray(review.issues) ? review.issues : [];
      const score = typeof review.score === "number" ? review.score : 0;
      setReviews([
        {
          id: `review_${Date.now()}`,
          contentItemId: contentId,
          score,
          issues,
          createdAt: new Date().toISOString(),
        },
        ...reviews,
      ]);
      toast.success(`质检完成，得分 ${score}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "质检失败");
    } finally {
      setReviewLoading(false);
    }
  };

  const hasDraft = Boolean(activeContent || draftBody.trim());

  return (
    <AppShell title="稿件 · 公众号图文">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">选题列表</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topics.slice(0, 12).map((topic) => {
              const content = contentItems.find(
                (item) => item.topicId === topic.id && item.platform === "wechat"
              );
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => selectTopic(topic.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                    activeTopicId === topic.id ? "border-slate-900" : ""
                  }`}
                >
                  <span className="block font-medium">{topic.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{topic.section}</span>
                    {content ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {sourceLabel(content.source)}
                      </Badge>
                    ) : isSeedTopicId(topic.id) ? (
                      <Badge variant="outline" className="text-[10px]">
                        种子稿
                      </Badge>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {error ? <ErrorState message={error} /> : null}

          {selectedTopic ? (
            <KnowledgeReferencePicker
              query={knowledgeQuery}
              value={knowledgeReferences}
              onChange={setKnowledgeReferences}
            />
          ) : null}

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">稿件操作</CardTitle>
                <p className="mt-1 text-xs text-slate-500">
                  {isImported
                    ? isEvaluation
                      ? "测评稿以你的测试过程与数据为准；AI 仅做润色，不会默认整篇重写。"
                      : "已有草稿以你的正文为准；AI 仅做润色，不会默认整篇重写。"
                    : "AI 生成稿会在出稿时自动去 AI 味。"}
                </p>
              </div>
              {hasDraft ? (
                <Badge variant={isImported ? "outline" : "secondary"}>
                  {sourceLabel(activeContent?.source ?? draftSource)}
                </Badge>
              ) : null}
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              <Button disabled={!selectedTopic || generateLoading} onClick={handleRegenerateClick}>
                {generateLoading
                  ? "处理中..."
                  : isImported
                    ? "AI 处理草稿"
                    : "根据选题重新生成"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!selectedTopic}
                onClick={() => setImportDialogOpen(true)}
              >
                导入 Markdown 草稿
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
                onClick={() => activeContent && loadContentIntoDraft(activeContent)}
              >
                放弃未保存修改
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">正文编辑</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!hasDraft ? (
                <EmptyState
                  title="暂无稿件"
                  description="可导入已有 Markdown 测评稿，或在选题页通过热点流程 AI 生成。"
                />
              ) : null}

              {hasDraft ? (
                <>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                      <label className="text-sm">状态</label>
                      <Select
                        value={draftStatus}
                        onValueChange={(value) => {
                          const target = value as ContentStatus;
                          setDraftStatus(target);
                          if (!activeContent) return;
                          const publishedAt =
                            target === "已发布"
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
                        <SelectTrigger className="w-full sm:w-48">
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

                  <details className="rounded-lg border bg-slate-50/50 px-3 py-2">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700">
                      发布信息（标题 / 摘要 / 封面文案）
                      <span className="ml-2 text-xs font-normal text-slate-500">{coverStatusHint}</span>
                    </summary>
                    <div className="mt-3 space-y-2">
                      <Input
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        placeholder="标题"
                      />
                      <Input
                        value={draftDigest}
                        onChange={(e) => setDraftDigest(e.target.value)}
                        placeholder="摘要（公众号列表展示，一两句话）"
                      />
                      <Input
                        value={draftCover}
                        onChange={(e) => setDraftCover(e.target.value)}
                        placeholder="封面文案（配图上的短句，可选）"
                      />
                      <p className="text-xs text-slate-500">
                        封面图提示词请在下方工具栏「封面图提示词」生成与查看（同一入口，不会重复生成）。
                      </p>
                    </div>
                  </details>

                  <details className="rounded-lg border bg-amber-50/40 px-3 py-2">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700">
                      补充信息（改稿用）
                    </summary>
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-slate-500">
                        填写模型实名、测试条件等事实更新；也可上传 .docx / .md / .txt，解析后追加到下方，AI
                        润色与质检时会自动融入正文。
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
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={supplementaryDocLoading}
                          onClick={() => supplementaryFileRef.current?.click()}
                        >
                          {supplementaryDocLoading ? "解析中…" : "上传补充文档"}
                        </Button>
                      </div>
                      <Textarea
                        value={draftSupplementaryNotes}
                        onChange={(e) => setDraftSupplementaryNotes(e.target.value)}
                        rows={6}
                        placeholder="例如：Cola-A 现为 August（Qwen 3.8 Flash）；Codex 使用 GPT 5.6 Sol，且全局误加载 haidian skill…"
                        className="font-mono text-sm leading-relaxed"
                      />
                    </div>
                  </details>

                  {readingAnalysis ? (
                    <div
                      className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600"
                      title={readingAnalysis.guidance}
                    >
                      <span className="font-medium text-slate-800">
                        {formatReadingTimeBadge(readingAnalysis)}
                      </span>
                      <span className="mx-2 text-slate-300">·</span>
                      <span>{readingAnalysis.charCount} 字</span>
                      <span className="mx-2 text-slate-300">·</span>
                      <span>{readingAnalysis.profileLabel}</span>
                      <span className="mx-2 text-slate-300">·</span>
                      <span className="line-clamp-1">{readingAnalysis.guidance}</span>
                    </div>
                  ) : null}

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
                    className="field-sizing-fixed h-80 resize-none overflow-y-auto font-mono text-sm leading-relaxed"
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

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        const contentId = activeContent?.id ?? `content_${Date.now()}`;
                        persistDraft(
                          {
                            id: contentId,
                            topicId: activeTopicId,
                            source: draftSource,
                            supplementaryNotes: draftSupplementaryNotes,
                            status:
                              draftStatus === "AI 草稿" && draftSource === "imported"
                                ? "编辑中"
                                : draftStatus,
                          },
                          "user_edit"
                        );
                        toast.success("草稿已保存");
                      }}
                    >
                      保存草稿
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!draftBody.trim() || illustrationLoading}
                      onClick={() => void analyzeIllustrations()}
                    >
                      {illustrationLoading
                        ? "分析中..."
                        : hasIllustrationCache
                          ? `查看配图建议${illustrationHint ? ` ${illustrationHint}` : ""}`
                          : `识别正文配图${illustrationHint ? ` ${illustrationHint}` : ""}`}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={coverLoading || (!draftTitle.trim() && !draftBody.trim())}
                      onClick={() => void analyzeCover()}
                    >
                      {coverLoading
                        ? "生成中..."
                        : hasCoverCache
                          ? `查看封面图提示词 ${coverStatusHint}`
                          : `生成封面图提示词 ${coverStatusHint}`}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={imageUploadLoading}
                      onClick={() => bodyImageInputRef.current?.click()}
                    >
                      {imageUploadLoading ? "上传中..." : "插入本地图片"}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!draftBody.trim() || reviewLoading}
                      onClick={() => void runReview()}
                    >
                      {reviewLoading ? "质检中..." : "运行质检"}
                    </Button>
                    <Button
                      disabled={exportWechatDocxLoading || !draftBody.trim()}
                      onClick={async () => {
                        setExportWechatDocxLoading(true);
                        try {
                          const { blob, fileName, clipboardText } = await buildWechatDocxBundle({
                            title: draftTitle,
                            digest: draftDigest,
                            body: draftBody,
                          });
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = fileName;
                          a.click();
                          URL.revokeObjectURL(a.href);
                          await navigator.clipboard.writeText(clipboardText);
                          toast.success(
                            "已导出 Word（正文无标题、图片内嵌）。标题和摘要已复制到剪贴板，请分别粘贴到公众号对应栏位。"
                          );
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Word 导出失败");
                        } finally {
                          setExportWechatDocxLoading(false);
                        }
                      }}
                    >
                      {exportWechatDocxLoading ? "导出中..." : "导出公众号 Word"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        const text = [draftTitle, "", draftDigest, "", draftBody].join("\n");
                        await navigator.clipboard.writeText(text);
                        toast.success("标题+摘要+正文已复制");
                      }}
                    >
                      复制图文
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const content = buildArticleMarkdown({
                          title: draftTitle,
                          digest: draftDigest,
                          body: draftBody,
                          includeTitle: false,
                        });
                        const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
                        const a = document.createElement("a");
                        a.href = URL.createObjectURL(blob);
                        a.download = "wechat-article-body.md";
                        a.click();
                        URL.revokeObjectURL(a.href);
                        toast.success("已导出 Markdown（不含标题，摘要保留为引用块）");
                      }}
                    >
                      导出 Markdown
                    </Button>
                    <Button
                      variant="outline"
                      disabled={exportBundleLoading || !draftBody.trim()}
                      onClick={async () => {
                        setExportBundleLoading(true);
                        try {
                          const { blob, fileName } = await buildMarkdownZipBundle({
                            title: draftTitle,
                            digest: draftDigest,
                            body: draftBody,
                          });
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = fileName;
                          a.click();
                          URL.revokeObjectURL(a.href);
                          toast.success(
                            exportableImages.local > 0
                              ? `已导出 Markdown 包（含 ${exportableImages.local} 张本地图）`
                              : "已导出 Markdown 包（暂无本地图，请先插入或替换占位链接）"
                          );
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "导出失败");
                        } finally {
                          setExportBundleLoading(false);
                        }
                      }}
                    >
                      {exportBundleLoading ? "打包中..." : "导出 Markdown 包"}
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    <strong className="font-medium text-slate-700">推荐：</strong>
                    用「导出公众号 Word」→ 在微信后台「文档导入」上传该 docx（单文件、图片已内嵌）。
                    标题/摘要会自动复制，分别填到标题栏和摘要栏。表格已居中、字号 10pt、加粗为 Word 原生粗体。
                    Markdown 包适合本地备份；占位图需先「插入本地图片」再导出。
                    {exportableImages.placeholder > 0
                      ? ` 当前还有 ${exportableImages.placeholder} 处待传图占位。`
                      : null}
                  </p>

                  {latestReview ? (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-800">
                          质检结果 · {latestReview.score} 分
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(latestReview.createdAt).toLocaleString("zh-CN")}
                        </span>
                      </div>
                      {(latestReview.issues ?? []).length === 0 ? (
                        <p className="text-slate-600">未发现明显问题，可以进入排期发布。</p>
                      ) : (
                        <ul className="space-y-2">
                          {(latestReview.issues ?? []).map((issue, index) => (
                            <li
                              key={`${issue.dimension}-${index}`}
                              className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
                            >
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-medium text-slate-800">{issue.dimension}</span>
                                <Badge
                                  variant={
                                    issue.severity === "high"
                                      ? "destructive"
                                      : issue.severity === "medium"
                                        ? "secondary"
                                        : "outline"
                                  }
                                  className="text-[10px]"
                                >
                                  {issue.severity === "high"
                                    ? "必须改"
                                    : issue.severity === "medium"
                                      ? "建议改"
                                      : "可选"}
                                </Badge>
                              </div>
                              <p className="mt-1 text-slate-600">{issue.suggestion}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={regenDialogOpen} onOpenChange={setRegenDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>如何处理已有草稿？</DialogTitle>
            <DialogDescription>
              {isEvaluation
                ? "检测到测评型正文（含测试过程或数据）。默认只做润色，不会整篇覆盖。"
                : "默认只做润色，保留你的正文结构与观点。从零重写会丢失现有内容。"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button disabled={generateLoading} onClick={() => void runGeneration("polish")}>
              润色去 AI 味（推荐，保留全文）
            </Button>
            {isEvaluation ? (
              <Button
                variant="secondary"
                disabled={generateLoading}
                onClick={() => void runGeneration("preserve_structure")}
              >
                保留测评结构，优化表达
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
              从零重写（会丢失原文）
            </Button>
          </div>
          <DialogFooter />
        </DialogContent>
      </Dialog>

      <IllustrationSuggestionsDialog
        open={illustrationDialogOpen}
        onOpenChange={setIllustrationDialogOpen}
        loading={illustrationLoading}
        summary={illustrationSummary}
        suggestions={illustrationSuggestions}
        insertedIds={insertedIds}
        onInsert={insertSuggestion}
        onRegenerate={() => void analyzeIllustrations({ force: true })}
      />

      <CoverSuggestionsDialog
        open={coverDialogOpen}
        onOpenChange={setCoverDialogOpen}
        loading={coverLoading}
        summary={coverSummary}
        variants={coverVariants}
        onApplyOverlay={setDraftCover}
        onRegenerate={() => void analyzeCover({ force: true })}
      />

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>导入 Markdown 草稿</DialogTitle>
            <DialogDescription>
              支持 <code># 标题</code>、<code>&gt; 摘要</code> 与正文。导入后标记为「已有草稿」，并保存原始快照供「恢复原始草稿」。
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={importRaw}
            onChange={(e) => setImportRaw(e.target.value)}
            rows={14}
            placeholder={"# 文章标题\n\n> 一两句摘要\n\n正文..."}
            className="font-mono text-sm"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.txt"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              setImportRaw(text);
              event.target.value = "";
            }}
          />
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              选择 .md 文件
            </Button>
            <Button type="button" onClick={importDraft}>
              导入并保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
