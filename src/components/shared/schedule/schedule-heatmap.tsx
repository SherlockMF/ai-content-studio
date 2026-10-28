"use client";

import { useMemo } from "react";
import { buildScheduleHeatmap, getScheduleHeatCounts, getScheduleHeatTone } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { ContentItem } from "@/types/domain";

const DAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

type HeatTone = "empty" | "scheduled" | "published";

function cellToneClass(tone: HeatTone) {
  if (tone === "published") return "bg-sky-400 hover:bg-sky-300 cursor-pointer";
  if (tone === "scheduled") return "bg-sky-900 hover:bg-sky-800 cursor-pointer";
  return "bg-slate-800/90 cursor-default";
}

export function ScheduleHeatmap({
  contentItems,
  onOpenItem,
}: {
  contentItems: ContentItem[];
  onOpenItem: (item: ContentItem) => void;
}) {
  const { weeks, monthLabels } = useMemo(
    () => buildScheduleHeatmap(contentItems, { pastWeeks: 6, futureWeeks: 10 }),
    [contentItems]
  );
  const litCount = useMemo(() => contentItems.filter((item) => item.scheduledAt).length, [contentItems]);
  const counts = useMemo(() => getScheduleHeatCounts(contentItems), [contentItems]);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0b0f14] p-4 text-slate-200 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-slate-100">发布排期</h3>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {litCount > 0 ? (
            <span>
              {counts.published} 已发布 · {counts.scheduled} 未发布 · 点击有排期的格子编辑
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
                  const tone = getScheduleHeatTone(cell.items);
                  const hasItems = cell.items.length > 0;
                  const statusHint = tone === "published" ? "已发布" : tone === "scheduled" ? "未发布" : "无稿";
                  const title = hasItems
                    ? `${cell.dateKey} · ${statusHint} · ${cell.items.map((item) => item.title).join(" / ")}`
                    : cell.dateKey;
                  return (
                    <button
                      key={cell.dateKey}
                      type="button"
                      title={title}
                      disabled={!hasItems}
                      onClick={() => {
                        if (cell.items.length > 0) onOpenItem(cell.items[0]);
                      }}
                      className={cn(
                        "h-3.5 w-3.5 rounded-[3px] transition",
                        cellToneClass(tone),
                        hasItems && tone === "empty" && "cursor-pointer hover:bg-slate-700",
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
                style={{ left: `calc(${label.weekIndex} * (0.875rem + 3px))` }}
              >
                {label.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
