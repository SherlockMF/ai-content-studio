"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { copyWithToast } from "@/lib/client-actions";
import {
  buildIllustrationImageBlock,
  buildIllustrationPlaceholder,
  insertAfterAnchor,
  IllustrationSuggestion,
} from "@/lib/illustrations/insert";

interface IllustrationSuggestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  summary?: string;
  suggestions: IllustrationSuggestion[];
  insertedIds: Set<string>;
  onInsert: (suggestion: IllustrationSuggestion) => boolean;
  /** 预留：一键生图后插入（当前 UI 未启用，API 仍保留） */
  onInsertGenerated?: (
    suggestion: IllustrationSuggestion,
    imageUrl: string
  ) => boolean;
  onRegenerate?: () => void;
}

export function IllustrationSuggestionsDialog({
  open,
  onOpenChange,
  loading,
  summary,
  suggestions,
  insertedIds,
  onInsert,
  onRegenerate,
}: IllustrationSuggestionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>配图建议</DialogTitle>
          <DialogDescription>
            已识别适合插图的位置。复制提示词到 ChatGPT 生图，或插入占位符后再替换图片链接。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-slate-500">正在分析正文中的配图位置…</p>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-slate-500">暂无建议，请先确保正文有足够内容。</p>
        ) : (
          <div className="space-y-4">
            {summary ? <p className="text-sm text-slate-600">{summary}</p> : null}
            {suggestions.map((item) => (
              <SuggestionCard
                key={item.id}
                item={item}
                inserted={insertedIds.has(item.id)}
                onInsert={() => onInsert(item)}
              />
            ))}
            {onRegenerate ? (
              <div className="flex justify-end border-t pt-3">
                <Button type="button" variant="outline" size="sm" onClick={onRegenerate}>
                  重新分析
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SuggestionCard({
  item,
  inserted,
  onInsert,
}: {
  item: IllustrationSuggestion;
  inserted: boolean;
  onInsert: () => boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const copyPrompt = () =>
    copyWithToast(item.gptPrompt, "配图提示词已复制，可粘贴到 ChatGPT 生图");

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-sm">{item.placementLabel}</p>
          <p className="mt-1 text-xs text-slate-500">{item.reason}</p>
        </div>
        <Badge variant="secondary">{item.imageKind}</Badge>
      </div>

      <p className="rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-600 font-mono leading-relaxed">
        锚点：{item.anchorSnippet}
      </p>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-700">GPT 配图提示词</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void copyPrompt()}>
            复制提示词
          </Button>
        </div>
        <Textarea
          readOnly
          value={item.gptPrompt}
          rows={expanded ? 8 : 4}
          className="text-xs font-mono"
        />
        <button
          type="button"
          className="text-xs text-slate-500 underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "收起" : "展开全文"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={inserted ? "outline" : "default"}
          disabled={inserted}
          onClick={() => {
            const ok = onInsert();
            if (ok) toast.success("已插入配图占位符");
            else toast.error("未找到锚点位置，请手动插入或调整正文后重试");
          }}
        >
          {inserted ? "已插入占位符" : "插入配图占位符"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void copyPrompt()}>
          去 GPT 生图
        </Button>
      </div>
    </div>
  );
}

export function useIllustrationInsert(
  body: string,
  setBody: (value: string) => void
) {
  const [insertedIds, setInsertedIds] = useState<Set<string>>(new Set());

  const insertSuggestion = (suggestion: IllustrationSuggestion) => {
    const block = buildIllustrationPlaceholder(suggestion.altText, suggestion.gptPrompt);
    const result = insertAfterAnchor(body, suggestion.anchorSnippet, block);
    if (!result.ok) return false;
    setBody(result.body);
    setInsertedIds((prev) => new Set(prev).add(suggestion.id));
    return true;
  };

  const insertGeneratedSuggestion = (
    suggestion: IllustrationSuggestion,
    imageUrl: string
  ) => {
    const block = buildIllustrationImageBlock(
      suggestion.altText,
      imageUrl,
      suggestion.gptPrompt
    );
    const result = insertAfterAnchor(body, suggestion.anchorSnippet, block);
    if (!result.ok) return false;
    setBody(result.body);
    setInsertedIds((prev) => new Set(prev).add(suggestion.id));
    return true;
  };

  const resetInserted = () => setInsertedIds(new Set());

  return {
    insertedIds,
    insertSuggestion,
    insertGeneratedSuggestion,
    resetInserted,
  };
}
