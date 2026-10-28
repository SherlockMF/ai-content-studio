"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONTENT_STATUSES } from "@/lib/content-status";
import { cn } from "@/lib/utils";
import type { ContentSource, ContentStatus } from "@/types/domain";
import { sourceLabel } from "./content-list-sidebar";

export type EditorPlatform = "wechat" | "xiaohongshu";

export function WechatEditorToolbar(props: {
  platform: EditorPlatform;
  onPlatformChange: (platform: EditorPlatform) => void;
  hasXiaohongshu: boolean;
  hasDraft: boolean;
  status: ContentStatus;
  onStatusChange: (status: ContentStatus) => void;
  source: ContentSource;
  polishedAt?: string;
  autosavePending: boolean;
  scheduledDate: string;
  onScheduleChange: (dateKey: string) => void;
  canAutoSchedule: boolean;
  onAutoSchedule: () => void;
  hasTopic: boolean;
  hasBody: boolean;
  generateLoading: boolean;
  mediaLoading: boolean;
  mediaProgress: string;
  reviewLoading: boolean;
  onRegenerate: () => void;
  onPublishPrepCheck: () => void;
  conversionPending: boolean;
  onConvertXiaohongshu: () => void;
  onDelete?: () => void;
}) {
  const isImported = props.source === "imported";
  const wechat = props.platform === "wechat";

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
      <div className="flex rounded-md bg-slate-100 p-0.5">
        <Button
          size="sm"
          className="h-7 px-2.5 text-xs"
          variant={wechat ? "default" : "ghost"}
          onClick={() => props.onPlatformChange("wechat")}
        >
          公众号
        </Button>
        <Button
          size="sm"
          className="h-7 px-2.5 text-xs"
          variant={props.platform === "xiaohongshu" ? "default" : "ghost"}
          onClick={() => props.onPlatformChange("xiaohongshu")}
        >
          小红书
          {props.hasXiaohongshu ? " · 已有" : ""}
        </Button>
      </div>
      {wechat && props.hasDraft ? (
        <>
          <Select
            value={props.status}
            onValueChange={(value) => props.onStatusChange(value as ContentStatus)}
          >
            <SelectTrigger className="h-7 w-[7.5rem] text-xs">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant={isImported ? "outline" : "secondary"} className="text-[10px]">
            {sourceLabel(props.source)}
          </Badge>
          {props.polishedAt ? (
            <Badge
              variant="outline"
              className="text-[10px] text-emerald-700"
              title={`最近润色：${new Date(props.polishedAt).toLocaleString()}`}
            >
              已 AI 润色
            </Badge>
          ) : null}
          <span
            className={cn(
              "text-[11px]",
              props.autosavePending ? "text-amber-600" : "text-slate-500"
            )}
          >
            {props.autosavePending ? "待自动保存" : "已自动保存"}
          </span>
        </>
      ) : null}
      {wechat ? (
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {props.hasDraft ? (
            <>
              <Input
                type="date"
                value={props.scheduledDate}
                onChange={(e) => props.onScheduleChange(e.target.value)}
                className="h-7 w-[9.5rem] text-xs"
                title="设置并锁定排期，自动规划会保留手动日期"
              />
              {props.canAutoSchedule ? (
                <Button size="sm" variant="outline" onClick={props.onAutoSchedule}>
                  自动安排日期
                </Button>
              ) : null}
            </>
          ) : null}
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!props.hasTopic || props.generateLoading || props.mediaLoading}
            onClick={props.onRegenerate}
          >
            {props.generateLoading
              ? props.mediaProgress || "润色处理中…"
              : isImported
                ? props.polishedAt
                  ? "再次润色"
                  : "AI 润色"
                : "重新生成"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            title="去 AI 味 → 规划/补齐配图 → 质检"
            disabled={!props.hasBody || props.generateLoading || props.mediaLoading || props.reviewLoading}
            onClick={props.onPublishPrepCheck}
          >
            {props.mediaLoading ? props.mediaProgress || "发布前检查中…" : "发布前检查"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={!props.hasBody || props.conversionPending}
            onClick={props.onConvertXiaohongshu}
          >
            {props.conversionPending
              ? "转换中…"
              : props.hasXiaohongshu
                ? "更新小红书"
                : "转小红书"}
          </Button>
          {props.onDelete ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-red-600 hover:text-red-700"
              onClick={props.onDelete}
            >
              删除
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="ml-auto flex flex-wrap items-center gap-1.5" />
      )}
    </div>
  );
}
