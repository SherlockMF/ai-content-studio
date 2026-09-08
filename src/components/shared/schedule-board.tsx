"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CONTENT_STATUSES,
  PLATFORM_OPTIONS,
  isPublishedLikeStatus,
  shouldStampPublishedAt,
} from "@/lib/content-status";
import {
  buildScheduleHeatmap,
  formatScheduleLabel,
  isWeekdayDateKey,
  type ScheduleHeatCell,
} from "@/lib/schedule";
import { useAppStore } from "@/lib/store/app-store";
import { ContentItem, ContentStatus, Platform } from "@/types/domain";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

type HeatTone = "empty" | "scheduled" | "published";

function cellHeatTone(cell: ScheduleHeatCell): HeatTone {
  if (cell.items.length === 0) return "empty";
  if (cell.items.some((item) => isPublishedLikeStatus(item.status))) return "published";
  return "scheduled";
}

function cellToneClass(tone: HeatTone) {
  if (tone === "published") return "bg-sky-400 hover:bg-sky-300 cursor-pointer";
  if (tone === "scheduled") return "bg-sky-900 hover:bg-sky-800 cursor-pointer";
  return "bg-slate-800/90 cursor-default";
}

export function ScheduleBoard() {
  const { contentItems, upsertContent, setContentSchedule } = useAppStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPlatform, setEditPlatform] = useState<Platform>("wechat");
  const [editStatus, setEditStatus] = useState<ContentStatus>("待发布");
  const [editDate, setEditDate] = useState("");

  const { weeks, monthLabels } = useMemo(
    () => buildScheduleHeatmap(contentItems, { pastWeeks: 6, futureWeeks: 10 }),
    [contentItems]
  );

  const litCount = useMemo(
    () => contentItems.filter((item) => item.scheduledAt).length,
    [contentItems]
  );
  const publishedCount = useMemo(
    () =>
      contentItems.filter(
        (item) => item.scheduledAt && isPublishedLikeStatus(item.status)
      ).length,
    [contentItems]
  );
  const scheduledOnlyCount = litCount - publishedCount;

  const activeItem = contentItems.find((item) => item.id === activeId) ?? null;

  const openItem = (item: ContentItem) => {
    setActiveId(item.id);
    setEditTitle(item.title);
    setEditPlatform(item.platform);
    setEditStatus(item.status);
    setEditDate((item.scheduledAt ?? "").slice(0, 10));
  };

  const handleCellClick = (cell: ScheduleHeatCell) => {
    if (cell.items.length === 0) return;
    openItem(cell.items[0]);
  };

  const saveEdits = () => {
    if (!activeItem) return;
    if (editDate && !isWeekdayDateKey(editDate)) {
      toast.message("当前日期不是工作日，仍将按你指定的日期保存");
    }
    const publishedAt = shouldStampPublishedAt(editStatus)
      ? activeItem.publishedAt ?? new Date().toISOString()
      : activeItem.publishedAt;
    upsertContent({
      ...activeItem,
      title: editTitle.trim() || activeItem.title,
      platform: editPlatform,
      status: editStatus,
      publishedAt,
      updatedAt: new Date().toISOString(),
    });
    setContentSchedule(activeItem.id, editDate || null, { cascade: true });
    toast.success(editDate ? "排期已更新，后续稿已顺延" : "已取消排期并重排其余稿");
    setActiveId(null);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0b0f14] p-4 text-slate-200 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-slate-100">发布排期</h3>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            {litCount > 0 ? (
              <span>
                {publishedCount} 已发布 · {scheduledOnlyCount} 未发布 · 点击有稿格编辑
              </span>
            ) : (
              <span>暂无排期</span>
            )}
            <span className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-[2px] bg-sky-400" />
                已发布
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-[2px] bg-sky-900" />
                未发布
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-[2px] bg-slate-800" />
                无稿
              </span>
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex w-4 shrink-0 flex-col justify-between py-0.5 text-[10px] leading-none text-slate-500">
            {DAY_LABELS.map((label, index) =>
              index % 2 === 1 ? (
                <span key={label} className="h-3.5">
                  {label}
                </span>
              ) : (
                <span key={label} className="h-3.5" />
              )
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex gap-[3px]">
              {weeks.map((week, weekIndex) => (
                <div key={week[0]?.dateKey ?? weekIndex} className="flex flex-col gap-[3px]">
                  {week.map((cell) => {
                    const tone = cellHeatTone(cell);
                    const lit = tone !== "empty";
                    const statusHint =
                      tone === "published"
                        ? "已发布"
                        : tone === "scheduled"
                          ? "未发布"
                          : "无稿";
                    const title = lit
                      ? `${cell.dateKey} · ${statusHint} · ${cell.items
                          .map((item) => item.title)
                          .join(" / ")}`
                      : cell.dateKey;
                    return (
                      <button
                        key={cell.dateKey}
                        type="button"
                        title={title}
                        disabled={!lit}
                        onClick={() => handleCellClick(cell)}
                        className={cn(
                          "h-3.5 w-3.5 rounded-[3px] transition",
                          cellToneClass(tone),
                          cell.items.length > 1 && "ring-1 ring-sky-200/40"
                        )}
                        aria-label={title}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="relative mt-2 h-4 text-[10px] text-slate-500">
              {monthLabels.map((label) => (
                <span
                  key={`${label.weekIndex}-${label.label}`}
                  className="absolute top-0"
                  style={{
                    left: `calc(${label.weekIndex} * (0.875rem + 3px))`,
                  }}
                >
                  {label.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Sheet
        open={Boolean(activeItem)}
        onOpenChange={(open) => {
          if (!open) setActiveId(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>排期详情</SheetTitle>
            <SheetDescription>调整状态与发布日期，或前往稿件页继续编辑。</SheetDescription>
          </SheetHeader>
          {activeItem ? (
            <div className="space-y-4 px-4 pb-4">
              <p className="text-xs text-slate-500">{formatScheduleLabel(activeItem.scheduledAt)}</p>
              <div className="space-y-1">
                <label className="text-sm">标题</label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm">平台</label>
                <Select value={editPlatform} onValueChange={(value) => setEditPlatform(value as Platform)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择平台" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm">状态</label>
                <Select value={editStatus} onValueChange={(value) => setEditStatus(value as ContentStatus)}>
                  <SelectTrigger className="w-full">
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
              <div className="space-y-1">
                <label className="text-sm">发布日期</label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>
            </div>
          ) : null}
          <SheetFooter className={cn("gap-2")}>
            <Link
              href={activeItem ? `/content?topicId=${activeItem.topicId}` : "/content"}
              className={buttonVariants({ variant: "outline" })}
            >
              去写稿
            </Link>
            <Button onClick={saveEdits}>保存排期</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
