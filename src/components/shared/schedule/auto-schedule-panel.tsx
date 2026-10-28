"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { isPublishedLikeStatus } from "@/lib/content-status";
import { formatScheduleLabel } from "@/lib/schedule";
import { topicsWithoutWechatDraft } from "@/lib/workspace-lists";
import type { ContentItem, Topic } from "@/types/domain";

function platformLabel(platform: ContentItem["platform"]) {
  if (platform === "wechat") return "公众号稿件";
  if (platform === "xiaohongshu") return "小红书稿件";
  return "抖音稿件";
}

function buildPlannedEntries(contentItems: ContentItem[], topics: Topic[]) {
  return [
    ...contentItems
      .filter((item) => item.scheduleMode === "auto" && item.scheduledAt && !isPublishedLikeStatus(item.status))
      .map((item) => ({
        id: item.id,
        title: item.title,
        date: item.scheduledAt!,
        reason: item.scheduleReason,
        label: platformLabel(item.platform),
        topicId: item.topicId,
      })),
    ...topicsWithoutWechatDraft(topics, contentItems)
      .filter((topic) => topic.suggestedScheduledAt)
      .map((topic) => ({
        id: topic.id,
        title: topic.title,
        date: topic.suggestedScheduledAt!,
        reason: topic.scheduleReason,
        label: "选题预排 · 待写稿",
        topicId: topic.id,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

export function AutoSchedulePanel({
  contentItems,
  topics,
  storeHydrated,
  autoScheduleEnabled,
  onAutoScheduleChange,
  onReplan,
}: {
  contentItems: ContentItem[];
  topics: Topic[];
  storeHydrated: boolean;
  autoScheduleEnabled: boolean;
  onAutoScheduleChange: (enabled: boolean) => void;
  onReplan: () => void;
}) {
  return (
    <section className="space-y-3 rounded-xl border bg-white p-4" aria-label="自动排期">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">自动排期</h3>
          <p className="text-xs text-slate-500">每个平台每个工作日一篇；根据标题、观点和板块关联安排，错开相似题材，兼顾热点和完成度。仅安排时间，不自动发布。</p>
        </div>
        <Button
          disabled={!storeHydrated}
          onClick={() => {
            onReplan();
            toast.success("已更新稿件排期与选题预排，新增选题将自动寻找合适档期");
          }}
        >
          自动排期 / 重新规划
        </Button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={autoScheduleEnabled}
          disabled={!storeHydrated}
          onCheckedChange={(checked) => onAutoScheduleChange(Boolean(checked))}
        />
        新增选题和稿件时自动调整预排
      </label>
      <p className="text-xs text-slate-500">已发布和手动排期保留。旧稿已有日期默认保留，可在排期详情中「纳入自动排期」。预排仍可手动调整。</p>
      <details>
        <summary className="cursor-pointer text-sm">查看自动档期和选题预排</summary>
        <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
          {buildPlannedEntries(contentItems, topics).map((item) => (
            <div key={item.id} className="rounded border p-2 text-xs">
              <Link className="font-medium underline" href={`/content?topicId=${encodeURIComponent(item.topicId)}`}>
                {formatScheduleLabel(item.date)} · {item.title}
              </Link>
              <p className="mt-1 text-slate-500">{item.label} · {item.reason}</p>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
