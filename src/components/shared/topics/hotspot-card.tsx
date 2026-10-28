"use client";

import { Badge } from "@/components/ui/badge";
import type { HotspotItem } from "@/lib/hotspots/types";
import { cn } from "@/lib/utils";

export function HotspotCard({
  item,
  active,
  onSelect,
}: {
  item: HotspotItem;
  active: boolean;
  onSelect: () => void;
}) {
  const sourceLabel =
    item.sourceName.length > 12 ? `${item.sourceName.slice(0, 12)}…` : item.sourceName;

  return (
    <button
      type="button"
      onClick={onSelect}
      title={item.title}
      className={cn(
        "flex h-28 flex-col rounded-lg border p-2.5 text-left transition hover:bg-white",
        active ? "border-slate-900 bg-white shadow-sm" : "border-slate-200 bg-white/80"
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <Badge variant="outline" className="max-w-[70%] truncate px-1.5 py-0 text-[10px]">
          {sourceLabel}
        </Badge>
        <span className="shrink-0 text-[10px] text-slate-400">{item.relevance}</span>
      </div>
      <p className="mt-2 line-clamp-3 flex-1 text-xs leading-5 font-medium text-slate-900">
        {item.title}
      </p>
      <span className="mt-1 text-[10px] text-slate-400">热度 {item.heat}</span>
    </button>
  );
}
