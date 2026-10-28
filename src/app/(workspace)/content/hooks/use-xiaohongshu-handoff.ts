"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { hasText } from "@/lib/has-text";
import { createUniqueId } from "@/lib/ids";
import type { ContentItem, ContentVersion } from "@/types/domain";
import type { WechatDraft } from "./use-wechat-draft";

/** 公众号稿 → 小红书编辑器的衔接：源稿快照、转换请求与版本保存 */
export function useXiaohongshuHandoff(input: {
  draft: WechatDraft;
  persistDraft: WechatDraft["persistDraft"];
  activeTopicId: string;
  activeContent: ContentItem | undefined;
  versions: ContentVersion[];
  upsertContent: (item: ContentItem) => void;
  addVersion: (version: ContentVersion) => void;
}) {
  const { activeContent, activeTopicId } = input;
  const { fields } = input.draft;
  const [conversionRequestId, setConversionRequestId] = useState(0);
  const [conversionPending, setConversionPending] = useState(false);
  const versionNumberRef = useRef<Record<string, number>>({});

  const sourceContentDraft = useMemo<ContentItem | null>(() => {
    if (!activeTopicId) return null;
    const fallbackDate = activeContent?.createdAt ?? "1970-01-01T00:00:00.000Z";
    return {
      ...(activeContent ?? {}),
      id: activeContent?.id ?? `content_${activeTopicId}`,
      workspaceId: activeContent?.workspaceId ?? "ws_demo",
      topicId: activeTopicId,
      platform: "wechat",
      ...fields,
      createdAt: fallbackDate,
      updatedAt: activeContent?.updatedAt ?? fallbackDate,
    };
  }, [activeContent, activeTopicId, fields]);

  const resetConversion = () => {
    setConversionRequestId(0);
    setConversionPending(false);
  };

  const saveXiaohongshuContent = (
    content: ContentItem,
    changeSource: "ai_generate" | "user_edit" | "ai_rewrite"
  ) => {
    const persistedVersionNumber = input.versions
      .filter((version) => version.contentItemId === content.id)
      .reduce((highest, version) => Math.max(highest, version.versionNumber), 0);
    const versionNumber =
      Math.max(persistedVersionNumber, versionNumberRef.current[content.id] ?? 0) + 1;
    versionNumberRef.current[content.id] = versionNumber;
    input.upsertContent(content);
    input.addVersion({
      id: createUniqueId("version"),
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
      createdAt: new Date().toISOString(),
    });
  };

  const requestConversion = () => {
    if (conversionPending) return;
    if (!sourceContentDraft || !hasText(sourceContentDraft.body)) {
      toast.error("请先填写公众号正文");
      return;
    }
    if (!activeContent) {
      input.persistDraft(
        {
          id: sourceContentDraft.id,
          topicId: sourceContentDraft.topicId,
          source: sourceContentDraft.source,
          status: sourceContentDraft.status,
        },
        "user_edit"
      );
    }
    setConversionPending(true);
    setConversionRequestId((requestId) => requestId + 1);
  };

  return {
    sourceContentDraft,
    conversionRequestId,
    conversionPending,
    settleConversion: () => setConversionPending(false),
    resetConversion,
    saveXiaohongshuContent,
    requestConversion,
  };
}
