"use client";

import type { RefObject } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { formatScheduleLabel } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { ContentItem, ContentSource, Topic } from "@/types/domain";

export function sourceLabel(source: ContentSource | undefined) {
  return source === "imported" ? "已有草稿" : "AI 生成";
}

export function ContentListSidebar({
  topics,
  activeContents,
  archivedContents,
  activeTopicId,
  selectedContentIds,
  scheduledJumpTargets,
  polishedAtByContent,
  itemRefs,
  onSelectTopic,
  onJumpToTopic,
  onToggleSelected,
  onDelete,
}: {
  topics: Topic[];
  activeContents: ContentItem[];
  archivedContents: ContentItem[];
  activeTopicId: string;
  selectedContentIds: string[];
  scheduledJumpTargets: Array<{ topicId: string; scheduledAt: string; label: string; title: string }>;
  polishedAtByContent: Record<string, string>;
  itemRefs: RefObject<Record<string, HTMLElement | null>>;
  onSelectTopic: (topicId: string) => void;
  onJumpToTopic: (topicId: string) => void;
  onToggleSelected: (contentId: string, checked: boolean) => void;
  onDelete: (ids: string[]) => void;
}) {
  const topicOf = (content: ContentItem) => topics.find((item) => item.id === content.topicId);
  const bindItemRef = (topicId: string) => (node: HTMLElement | null) => {
    itemRefs.current[topicId] = node;
  };

  return (
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
              onClick={() => onDelete(selectedContentIds)}
            >
              删除 {selectedContentIds.length}
            </Button>
          ) : null}
        </div>
        {scheduledJumpTargets.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-[11px] text-slate-500">按排期日定位</p>
            <div className="flex flex-wrap gap-1.5">
              {scheduledJumpTargets.map((item) => (
                <button
                  key={`${item.topicId}-${item.scheduledAt}`}
                  type="button"
                  title={item.title}
                  onClick={() => onJumpToTopic(item.topicId)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[11px] leading-none transition",
                    item.topicId === activeTopicId
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900"
                  )}
                >
                  {item.label}
                </button>
              ))}
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
            const topic = topicOf(content);
            return (
              <div
                key={content.id}
                ref={bindItemRef(content.topicId)}
                className={cn(
                  "flex items-start gap-2 rounded-lg border px-2 py-2 text-sm hover:bg-slate-50",
                  activeTopicId === content.topicId && "border-slate-900"
                )}
              >
                <Checkbox
                  checked={selectedContentIds.includes(content.id)}
                  onCheckedChange={(value) => onToggleSelected(content.id, value === true)}
                  className="mt-1"
                  aria-label={`选择 ${content.title || topic?.title || "稿件"}`}
                />
                <button
                  type="button"
                  onClick={() => onSelectTopic(content.topicId)}
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
              {archivedContents.map((content) => (
                <button
                  key={content.id}
                  type="button"
                  ref={bindItemRef(content.topicId)}
                  onClick={() => onSelectTopic(content.topicId)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50",
                    activeTopicId === content.topicId && "border-slate-900"
                  )}
                >
                  <span className="block font-medium">{content.title || topicOf(content)?.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {content.scheduledAt ? (
                      <span>{formatScheduleLabel(content.scheduledAt)}</span>
                    ) : null}
                    <Badge variant="outline" className="text-[10px]">
                      已归档
                    </Badge>
                  </span>
                </button>
              ))}
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
