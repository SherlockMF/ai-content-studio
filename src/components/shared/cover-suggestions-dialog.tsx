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
import { withLLMPayload } from "@/lib/ai/llm-settings";
import { coverPromptRefineOutputSchema } from "@/lib/ai/schemas";
import { hasText } from "@/lib/has-text";
import { CoverImageVariant } from "@/lib/illustrations/cover";

interface CoverSuggestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  summary?: string;
  variants: CoverImageVariant[];
  onApplyOverlay: (text: string) => void;
  /** 预留：一键生图写入封面（当前 UI 未启用，API 仍保留） */
  onApplyCoverImage?: (input: {
    url: string;
    overlayText: string;
    gptPrompt: string;
    altText: string;
  }) => void;
  onVariantChange: (id: string, patch: Partial<CoverImageVariant>) => void;
  onRegenerate?: () => void;
}

export function CoverSuggestionsDialog({
  open,
  onOpenChange,
  loading,
  summary,
  variants,
  onApplyOverlay,
  onVariantChange,
  onRegenerate,
}: CoverSuggestionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>封面图提示词</DialogTitle>
          <DialogDescription>
            公众号头条封面 2.35:1。复制提示词到 ChatGPT 生图。可在每套方案下填写修改建议并优化后再复制。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          variants.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">正在重新生成封面图方案…</p>
              {variants.map((item) => (
                <CoverVariantCard
                  key={item.id}
                  item={item}
                  onApplyOverlay={onApplyOverlay}
                  onVariantChange={onVariantChange}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">正在生成封面图方案…</p>
          )
        ) : variants.length === 0 ? (
          <p className="text-sm text-slate-500">暂无方案，请先填写标题。</p>
        ) : (
          <div className="space-y-4">
            {summary ? <p className="text-sm text-slate-600">{summary}</p> : null}
            {variants.map((item) => (
              <CoverVariantCard
                key={item.id}
                item={item}
                onApplyOverlay={onApplyOverlay}
                onVariantChange={onVariantChange}
              />
            ))}
            {onRegenerate ? (
              <div className="flex justify-end border-t pt-3">
                <Button type="button" variant="outline" size="sm" onClick={onRegenerate}>
                  重新生成
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CoverVariantCard({
  item,
  onApplyOverlay,
  onVariantChange,
}: {
  item: CoverImageVariant;
  onApplyOverlay: (text: string) => void;
  onVariantChange: (id: string, patch: Partial<CoverImageVariant>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [refining, setRefining] = useState(false);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(item.gptPrompt);
    toast.success("已复制提示词");
  };

  const refinePrompt = async () => {
    if (!hasText(suggestion) || refining) return;
    setRefining(true);
    try {
      const response = await fetch("/api/ai/cover/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withLLMPayload({
            title: undefined,
            styleLabel: item.styleLabel,
            overlayText: item.overlayText,
            gptPrompt: item.gptPrompt,
            suggestion: suggestion.trim(),
          })
        ),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.message === "string" ? payload.message : "优化失败"
        );
      }
      const refined = coverPromptRefineOutputSchema.parse(payload);
      onVariantChange(item.id, {
        gptPrompt: refined.gptPrompt,
        ...(refined.overlayText ? { overlayText: refined.overlayText } : {}),
      });
      toast.success("已按建议优化提示词");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "优化失败");
    } finally {
      setRefining(false);
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-medium text-sm">{item.styleLabel}</p>
        <Badge variant="secondary">2.35:1</Badge>
      </div>

      <p className="text-sm text-slate-600">
        封面短文案建议：<span className="font-medium text-slate-900">{item.overlayText}</span>
      </p>
      {item.notes ? <p className="text-xs text-slate-500">{item.notes}</p> : null}

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-700">封面图提示词</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void copyPrompt()}>
            复制提示词
          </Button>
        </div>
        <Textarea
          readOnly
          value={item.gptPrompt}
          rows={expanded ? 10 : 4}
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

      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-700" htmlFor={`cover-refine-${item.id}`}>
          修改建议
        </label>
        <Textarea
          id={`cover-refine-${item.id}`}
          value={suggestion}
          onChange={(event) => setSuggestion(event.target.value)}
          placeholder="例如：背景改成深蓝、主图标换成电路板、标题字再大一点…"
          rows={3}
          className="text-sm"
          disabled={refining}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!hasText(suggestion) || refining}
          onClick={() => void refinePrompt()}
        >
          {refining ? "优化中…" : "根据建议优化"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => void copyPrompt()}>
          去 GPT 生图
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            onApplyOverlay(item.overlayText);
            toast.success("已填入封面文案");
          }}
        >
          采用此封面文案
        </Button>
      </div>
    </div>
  );
}
