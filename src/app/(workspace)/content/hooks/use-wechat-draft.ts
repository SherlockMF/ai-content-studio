"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { factSnapshotToReport, type FactDiffReport } from "@/lib/fact-diff";
import { createId } from "@/lib/ids";
import { normalizeWechatLayout, type WechatLayoutSettings } from "@/lib/markdown/wechat-theme";
import type {
  ContentItem,
  ContentSource,
  ContentStatus,
  ContentVersion,
} from "@/types/domain";

const AUTOSAVE_DELAY_MS = 700;

export interface WechatDraftFields {
  title: string;
  digest: string;
  coverCopy: string;
  body: string;
  cta: string;
  supplementaryNotes: string;
  status: ContentStatus;
  source: ContentSource;
  wechatLayout: WechatLayoutSettings;
}

export type DraftChangeSource = "user_edit" | "ai_generate" | "ai_rewrite" | "restore";

export type DraftPatch = Partial<ContentItem> & { id: string; topicId: string };

export type DraftSnapshot = WechatDraftFields & {
  topicId: string;
  contentId?: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt?: string;
  importBaseline?: ContentItem["importBaseline"];
  brandIconRefs?: ContentItem["brandIconRefs"];
  coverPromptPack?: ContentItem["coverPromptPack"];
  lastFactDiff?: ContentItem["lastFactDiff"];
  workspaceId: string;
};

export const EMPTY_DRAFT_FIELDS: WechatDraftFields = {
  title: "",
  digest: "",
  coverCopy: "",
  body: "",
  cta: "",
  supplementaryNotes: "",
  status: "编辑中",
  source: "imported",
  wechatLayout: normalizeWechatLayout(undefined),
};

function fieldsFromContent(content: ContentItem | null | undefined): WechatDraftFields {
  return {
    title: content?.title ?? "",
    digest: content?.digest ?? "",
    coverCopy: content?.coverCopy ?? "",
    body: content?.body ?? "",
    cta: content?.cta ?? "",
    supplementaryNotes: content?.supplementaryNotes ?? "",
    status: content?.status ?? "编辑中",
    source: content?.source ?? "imported",
    wechatLayout: normalizeWechatLayout(content?.wechatLayout),
  };
}

function sameFields(a: WechatDraftFields, b: WechatDraftFields) {
  return (
    a.title === b.title &&
    a.digest === b.digest &&
    a.coverCopy === b.coverCopy &&
    a.body === b.body &&
    a.cta === b.cta &&
    a.supplementaryNotes === b.supplementaryNotes &&
    a.status === b.status &&
    a.source === b.source &&
    a.wechatLayout.theme === b.wechatLayout.theme &&
    a.wechatLayout.numberSections === b.wechatLayout.numberSections &&
    a.wechatLayout.emphasize === b.wechatLayout.emphasize
  );
}

function draftFieldsEqual(stored: ContentItem | null | undefined, draft: WechatDraftFields) {
  if (!stored) return false;
  const layout = normalizeWechatLayout(stored.wechatLayout);
  return (
    stored.title === draft.title &&
    (stored.digest ?? "") === draft.digest &&
    (stored.coverCopy ?? "") === draft.coverCopy &&
    (stored.body ?? "") === draft.body &&
    (stored.cta ?? "") === draft.cta &&
    (stored.supplementaryNotes ?? "") === draft.supplementaryNotes &&
    stored.status === draft.status &&
    stored.source === draft.source &&
    layout.theme === draft.wechatLayout.theme &&
    layout.numberSections === draft.wechatLayout.numberSections &&
    layout.emphasize === draft.wechatLayout.emphasize
  );
}

function buildSnapshot(
  topicId: string,
  fields: WechatDraftFields,
  content: ContentItem | null | undefined
): DraftSnapshot {
  return {
    topicId,
    ...fields,
    contentId: content?.id,
    scheduledAt: content?.scheduledAt ?? null,
    publishedAt: content?.publishedAt ?? null,
    createdAt: content?.createdAt,
    importBaseline: content?.importBaseline,
    brandIconRefs: content?.brandIconRefs,
    coverPromptPack: content?.coverPromptPack,
    lastFactDiff: content?.lastFactDiff,
    workspaceId: content?.workspaceId ?? "ws_demo",
  };
}

/**
 * 公众号草稿的编辑态：字段、自动保存与持久化。
 * `loadedFields` 记录最近一次程序化载入的字段，与之相同的草稿不触发自动保存。
 */
export function useWechatDraft(input: {
  initialContent: ContentItem | null;
  activeTopicId: string;
  activeContent: ContentItem | undefined;
  contentItems: ContentItem[];
  versionCount: number;
  upsertContent: (item: ContentItem) => void;
  addVersion: (version: ContentVersion) => void;
}) {
  const { activeTopicId, activeContent, contentItems, upsertContent } = input;
  const [fields, setFields] = useState(() => fieldsFromContent(input.initialContent));
  const [loadedFields, setLoadedFields] = useState<WechatDraftFields | null>(null);
  const [factDiffReport, setFactDiffReport] = useState<FactDiffReport | null>(null);
  const [factDiffAcknowledged, setFactDiffAcknowledged] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentItemsRef = useRef(contentItems);
  const upsertContentRef = useRef(upsertContent);
  const draftRef = useRef<DraftSnapshot>(
    buildSnapshot(activeTopicId, fields, input.initialContent)
  );

  useLayoutEffect(() => {
    contentItemsRef.current = contentItems;
    upsertContentRef.current = upsertContent;
    draftRef.current = buildSnapshot(activeTopicId, fields, activeContent);
  });

  const updateFields = useCallback((patch: Partial<WechatDraftFields>) => {
    setFields((current) => ({ ...current, ...patch }));
  }, []);
  const setBody = useCallback((body: string) => updateFields({ body }), [updateFields]);

  const cancelAutosave = () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
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
    if (draftFieldsEqual(existing, draft)) return existing ?? null;

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
      wechatLayout: draft.wechatLayout,
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
    return next;
  }, []);

  const loadContentIntoDraft = (content: ContentItem) => {
    const next = fieldsFromContent(content);
    setFields(next);
    setLoadedFields(next);
    draftRef.current = buildSnapshot(content.topicId, next, content);
    if (content.lastFactDiff) {
      setFactDiffReport(factSnapshotToReport(content.lastFactDiff));
      setFactDiffAcknowledged(Boolean(content.lastFactDiff.acknowledgedAt));
    } else {
      setFactDiffReport(null);
      setFactDiffAcknowledged(false);
    }
  };

  /** 以程序方式替换草稿字段（不触发自动保存） */
  const resetDraft = (next: WechatDraftFields) => {
    setFields(next);
    setLoadedFields(next);
  };

  const clearFactDiff = () => {
    setFactDiffReport(null);
    setFactDiffAcknowledged(false);
  };

  const persistDraft = (patch: DraftPatch, changeSource: DraftChangeSource = "user_edit") => {
    cancelAutosave();
    const now = new Date().toISOString();
    // 润色期间可以继续调排版，异步回调不能用旧 render 的 fields 覆盖新选择。
    const latestLayout = draftRef.current.topicId === patch.topicId
      ? draftRef.current.wechatLayout
      : contentItemsRef.current.find(item => item.topicId === patch.topicId && item.platform === "wechat")?.wechatLayout;
    const next: ContentItem = {
      id: patch.id,
      workspaceId: "ws_demo",
      topicId: patch.topicId,
      platform: "wechat",
      source: patch.source ?? fields.source,
      title: patch.title ?? fields.title,
      digest: patch.digest ?? fields.digest,
      coverCopy: patch.coverCopy ?? fields.coverCopy,
      body: patch.body ?? fields.body,
      cta: patch.cta ?? fields.cta,
      wechatLayout: patch.wechatLayout ?? normalizeWechatLayout(latestLayout),
      importBaseline: patch.importBaseline ?? activeContent?.importBaseline,
      supplementaryNotes: patch.supplementaryNotes ?? fields.supplementaryNotes,
      brandIconRefs: patch.brandIconRefs ?? activeContent?.brandIconRefs,
      coverPromptPack: patch.coverPromptPack ?? activeContent?.coverPromptPack,
      lastFactDiff: patch.lastFactDiff ?? activeContent?.lastFactDiff,
      status: patch.status ?? fields.status,
      createdAt: patch.createdAt ?? activeContent?.createdAt ?? now,
      updatedAt: now,
      scheduledAt: patch.scheduledAt ?? activeContent?.scheduledAt ?? null,
      publishedAt: patch.publishedAt ?? activeContent?.publishedAt ?? null,
    };
    upsertContent(next);
    input.addVersion({
      id: createId("version"),
      contentItemId: next.id,
      versionNumber: input.versionCount + 1,
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
    loadContentIntoDraft(next);
    return next;
  };

  const hasSaveableText = Boolean(fields.title.trim() || fields.body.trim());
  const autosavePending =
    Boolean(activeTopicId) &&
    hasSaveableText &&
    !draftFieldsEqual(activeContent, fields) &&
    !(loadedFields && sameFields(loadedFields, fields));

  useEffect(() => {
    if (!autosavePending) return;
    const timer = setTimeout(() => {
      flushAutosave();
    }, AUTOSAVE_DELAY_MS);
    autosaveTimerRef.current = timer;
    return () => {
      clearTimeout(timer);
      if (autosaveTimerRef.current === timer) autosaveTimerRef.current = null;
    };
  }, [autosavePending, fields, activeContent, flushAutosave]);

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

  return {
    fields,
    updateFields,
    setBody,
    draftRef,
    contentItemsRef,
    autosavePending,
    factDiffReport,
    setFactDiffReport,
    factDiffAcknowledged,
    setFactDiffAcknowledged,
    flushAutosave,
    persistDraft,
    loadContentIntoDraft,
    resetDraft,
    clearFactDiff,
    cancelAutosave,
  };
}

export type WechatDraft = ReturnType<typeof useWechatDraft>;
