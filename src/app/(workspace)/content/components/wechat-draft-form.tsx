"use client";

import { useMemo, type RefObject } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeReadingTime,
  formatReadingTimeBadge,
  resolveReadingProfile,
} from "@/lib/reading-time";
import type { ContentSection } from "@/types/domain";
import type { WechatDraftFields } from "../hooks/use-wechat-draft";

export function WechatDraftForm({
  fields,
  onChange,
  isEvaluation,
  section,
  textareaRef,
  onBodySelection,
}: {
  fields: WechatDraftFields;
  onChange: (patch: Partial<WechatDraftFields>) => void;
  isEvaluation: boolean;
  section?: ContentSection;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onBodySelection: () => void;
}) {
  const readingAnalysis = useMemo(() => {
    if (!fields.body.trim()) return null;
    return analyzeReadingTime(fields.body, resolveReadingProfile({ isEvaluation, section }));
  }, [fields.body, isEvaluation, section]);

  return (
    <>
      <div className="space-y-2">
        <Input
          value={fields.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="标题"
          className="h-11 border-0 bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={fields.digest}
            onChange={(e) => onChange({ digest: e.target.value })}
            placeholder="摘要"
            className="h-8 text-sm"
          />
          <Input
            value={fields.coverCopy}
            onChange={(e) => onChange({ coverCopy: e.target.value })}
            placeholder="封面短文案"
            className="h-8 text-sm"
          />
        </div>
        {readingAnalysis ? (
          <p className="text-[11px] text-slate-500" title={readingAnalysis.guidance}>
            <span className="font-medium text-slate-700">
              {formatReadingTimeBadge(readingAnalysis)}
            </span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span>{readingAnalysis.charCount} 字</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span>{readingAnalysis.profileLabel}</span>
          </p>
        ) : null}
      </div>

      <Textarea
        ref={textareaRef}
        value={fields.body}
        onSelect={onBodySelection}
        onKeyUp={onBodySelection}
        onClick={onBodySelection}
        onChange={(e) => {
          onBodySelection();
          onChange({ body: e.target.value });
        }}
        className="field-sizing-fixed min-h-[min(58vh,36rem)] resize-y overflow-y-auto font-mono text-sm leading-relaxed"
        placeholder="正文 Markdown（测评结构、数据、章节请写在这里）"
      />
    </>
  );
}
