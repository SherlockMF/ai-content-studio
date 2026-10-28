"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { formatScheduleLabel } from "@/lib/schedule";
import { getSeedContentByTopicId } from "@/lib/seed/restore";
import type { ContentItem, Topic } from "@/types/domain";
import { EMPTY_DRAFT_FIELDS, type WechatDraft } from "./use-wechat-draft";

export function useContentSelection(input: {
  topics: Topic[];
  contentItems: ContentItem[];
  activeContents: ContentItem[];
  archivedContents: ContentItem[];
  activeContent: ContentItem | undefined;
  setActiveTopicId: (topicId: string) => void;
  draft: WechatDraft;
  loadContent: (content: ContentItem) => void;
  deleteContent: (ids: string[]) => void;
  /** 切换稿件时重置与当前稿绑定的临时状态 */
  onSwitch: () => void;
}) {
  const { draft, activeContents, archivedContents } = input;
  const [selectedContentIds, setSelectedContentIds] = useState<string[]>([]);
  const topicListItemRefs = useRef<Record<string, HTMLElement | null>>({});

  const scheduledJumpTargets = useMemo(
    () =>
      activeContents
        .filter((item) => item.scheduledAt)
        .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""))
        .map((item) => ({
          topicId: item.topicId,
          scheduledAt: item.scheduledAt!,
          label: formatScheduleLabel(item.scheduledAt),
          title: item.title,
        })),
    [activeContents]
  );

  const selectTopic = (topicId: string, options?: { skipFlush?: boolean }) => {
    if (!options?.skipFlush) draft.flushAutosave();
    input.onSwitch();
    input.setActiveTopicId(topicId);
    draft.clearFactDiff();
    const content = input.contentItems.find(
      (item) => item.topicId === topicId && item.platform === "wechat"
    );
    const loadable = content ?? getSeedContentByTopicId(topicId);
    if (loadable) {
      input.loadContent(loadable);
      return;
    }
    const topic = input.topics.find((item) => item.id === topicId);
    draft.resetDraft({ ...EMPTY_DRAFT_FIELDS, title: topic?.title ?? "" });
  };

  const jumpToScheduledTopic = (topicId: string) => {
    selectTopic(topicId);
    requestAnimationFrame(() => {
      topicListItemRefs.current[topicId]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  };

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
    const removingActive = ids.includes(input.activeContent?.id ?? "");
    const remaining = activeContents.filter((item) => !ids.includes(item.id));
    if (removingActive) draft.cancelAutosave();
    input.deleteContent(ids);
    setSelectedContentIds((current) => current.filter((id) => !ids.includes(id)));
    toast.success(
      ids.length === 1 ? "稿件已删除，剩余排期已顺延" : `已删除 ${ids.length} 篇，剩余排期已顺延`
    );
    if (!removingActive) return;
    const fallback = remaining[0] ?? archivedContents[0];
    if (fallback) {
      selectTopic(fallback.topicId, { skipFlush: true });
    } else {
      draft.resetDraft({ ...EMPTY_DRAFT_FIELDS, source: draft.fields.source });
    }
  };

  return {
    selectedContentIds,
    topicListItemRefs,
    scheduledJumpTargets,
    selectTopic,
    jumpToScheduledTopic,
    toggleContentSelected,
    handleDeleteContents,
  };
}
