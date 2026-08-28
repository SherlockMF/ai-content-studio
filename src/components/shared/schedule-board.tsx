"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { CONTENT_STATUSES, PLATFORM_OPTIONS } from "@/lib/content-status";
import {
  formatFridayLabel,
  isFridayDateKey,
  remapToConsecutiveFridays,
} from "@/lib/schedule";
import { useAppStore } from "@/lib/store/app-store";
import { ContentItem, ContentStatus, Platform } from "@/types/domain";
import { cn } from "@/lib/utils";

function SortableRow({
  item,
  onOpen,
}: {
  item: ContentItem;
  onOpen: (item: ContentItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="relative">
        <button
          type="button"
          className="absolute top-3 right-3 z-10 cursor-grab text-slate-400 hover:text-slate-600"
          {...attributes}
          {...listeners}
          aria-label="拖拽调整排期"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="w-full p-4 pr-10 text-left hover:bg-slate-50"
          onClick={() => onOpen(item)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium text-slate-500">
                {formatFridayLabel(item.scheduledAt)}
              </p>
              <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
              <p className="text-xs text-slate-500">{item.status}</p>
            </div>
          </div>
        </button>
      </Card>
    </div>
  );
}

export function ScheduleBoard() {
  const { contentItems, upsertContent } = useAppStore();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPlatform, setEditPlatform] = useState<Platform>("wechat");
  const [editStatus, setEditStatus] = useState<ContentStatus>("待发布");
  const [editDate, setEditDate] = useState("");

  const sortedItems = useMemo(
    () =>
      [...contentItems]
        .filter((item) => item.scheduledAt)
        .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "")),
    [contentItems]
  );

  const activeItem = sortedItems.find((item) => item.id === activeId) ?? null;

  const openItem = (item: ContentItem) => {
    setActiveId(item.id);
    setEditTitle(item.title);
    setEditPlatform(item.platform);
    setEditStatus(item.status);
    setEditDate((item.scheduledAt ?? "").slice(0, 10));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedItems.findIndex((item) => item.id === active.id);
    const newIndex = sortedItems.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const moved = arrayMove(sortedItems, oldIndex, newIndex);
    const remapped = remapToConsecutiveFridays(moved);
    remapped.forEach((item) => upsertContent(item));
    toast.success("已按周五节奏重排");
  };

  const saveEdits = () => {
    if (!activeItem) return;
    if (editDate && !isFridayDateKey(editDate)) {
      toast.message("提示：默认节奏是每周五，当前日期不是周五，仍将按你指定的日期保存");
    }
    const publishedAt =
      editStatus === "已发布"
        ? activeItem.publishedAt ?? new Date().toISOString()
        : activeItem.publishedAt;
    upsertContent({
      ...activeItem,
      title: editTitle.trim() || activeItem.title,
      platform: editPlatform,
      status: editStatus,
      publishedAt,
      scheduledAt: editDate ? new Date(`${editDate}T12:00:00`).toISOString() : null,
      updatedAt: new Date().toISOString(),
    });
    toast.success("排期已更新");
    setActiveId(null);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">默认每周五一篇。拖拽可改顺序；点击条目可编辑排期信息。</p>

      {sortedItems.length === 0 ? (
        <EmptyState
          title="暂无排期"
          description="在选题中点击「加入排期」，将自动排到下一个可用周五。"
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortedItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <div className="grid gap-2 md:grid-cols-2">
              {sortedItems.map((item) => (
                <SortableRow key={item.id} item={item} onOpen={openItem} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

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
            <Link href="/content" className={buttonVariants({ variant: "outline" })}>
              去写稿
            </Link>
            <Button onClick={saveEdits}>保存排期</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
