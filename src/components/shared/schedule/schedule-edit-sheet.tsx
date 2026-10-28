"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { formatScheduleLabel, isWeekdayDateKey } from "@/lib/schedule";
import { useContentState, useStoreActions } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";
import type { ContentItem, ContentStatus, Platform } from "@/types/domain";

export function useScheduleEditor() {
  const { contentItems } = useContentState();
  const { upsertContent, setContentSchedule, unlockContentSchedule } = useStoreActions();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState<Platform>("wechat");
  const [status, setStatus] = useState<ContentStatus>("待发布");
  const [date, setDate] = useState("");

  const activeItem = contentItems.find((item) => item.id === activeId) ?? null;

  const openItem = (item: ContentItem) => {
    setActiveId(item.id);
    setTitle(item.title);
    setPlatform(item.platform);
    setStatus(item.status);
    setDate((item.scheduledAt ?? "").slice(0, 10));
  };

  const close = () => setActiveId(null);

  const save = () => {
    if (!activeItem) return;
    if (date && !isWeekdayDateKey(date)) {
      toast.message("当前日期不是工作日，仍将按你指定的日期保存");
    }
    const publishedAt = shouldStampPublishedAt(status)
      ? activeItem.publishedAt ?? new Date().toISOString()
      : activeItem.publishedAt;
    upsertContent({
      ...activeItem,
      title: title.trim() || activeItem.title,
      platform,
      status,
      publishedAt,
      updatedAt: new Date().toISOString(),
    });
    setContentSchedule(activeItem.id, date || null, { cascade: true });
    toast.success(date ? "排期已手动锁定，其余自动档期已调整" : "已取消并锁定为不排期，可重新纳入自动排期");
    close();
  };

  const unlock = () => {
    if (!activeItem) return;
    unlockContentSchedule(activeItem.id);
    close();
    toast.success("已纳入自动排期");
  };

  return {
    activeItem,
    fields: { title, platform, status, date },
    setTitle,
    setPlatform,
    setStatus,
    setDate,
    openItem,
    close,
    save,
    unlock,
  };
}

export type ScheduleEditor = ReturnType<typeof useScheduleEditor>;

export function ScheduleEditSheet({ editor }: { editor: ScheduleEditor }) {
  const { activeItem, fields } = editor;

  return (
    <Sheet
      open={Boolean(activeItem)}
      onOpenChange={(open) => {
        if (!open) editor.close();
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>排期详情</SheetTitle>
          <SheetDescription>调整状态与发布日期，或前往稿件页继续编辑。</SheetDescription>
        </SheetHeader>
        {activeItem ? (
          <div className="space-y-4 px-4 pb-4">
            <p className="text-xs text-slate-500">{formatScheduleLabel(activeItem.scheduledAt)} · {activeItem.scheduleMode === "auto" ? "自动排期" : "手动保留"}</p>
            {activeItem.scheduleReason ? <p className="text-xs text-slate-500">{activeItem.scheduleReason}</p> : null}
            {!isPublishedLikeStatus(activeItem.status) && !activeItem.publishedAt ? (
              <Button variant="outline" onClick={editor.unlock}>纳入自动排期</Button>
            ) : null}
            <div className="space-y-1">
              <label className="text-sm">标题</label>
              <Input value={fields.title} onChange={(e) => editor.setTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm">平台</label>
              <Select value={fields.platform} onValueChange={(value) => editor.setPlatform(value as Platform)}>
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
              <Select value={fields.status} onValueChange={(value) => editor.setStatus(value as ContentStatus)}>
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
              <Input type="date" value={fields.date} onChange={(e) => editor.setDate(e.target.value)} />
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
          <Button onClick={editor.save}>保存排期</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
