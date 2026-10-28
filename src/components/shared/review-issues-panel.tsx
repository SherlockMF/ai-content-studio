"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { requestReviewRevision } from "@/lib/api-client";
import { reviewRevisionDraftSchema, reviewRevisionSignature, selectedReviewIssues, type ReviewRevisionDraft } from "@/lib/review-revision";
import type { ContentReview } from "@/types/domain";

interface Props {
  review: ContentReview;
  draft: ReviewRevisionDraft;
  sourceBody?: string;
  supplementaryNotes?: string;
  targetAudience: string;
  onApply: (draft: ReviewRevisionDraft) => void;
  disabled?: boolean;
  stale?: boolean;
}

export function ReviewIssuesPanel({ review, draft, sourceBody, supplementaryNotes, targetAudience, onApply, disabled, stale }: Props) {
  const [selected, setSelected] = useState(() => review.issues.flatMap((issue, i) => issue.severity === "high" ? [i] : []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const signature = reviewRevisionSignature(draft, sourceBody, supplementaryNotes);
  const currentSignature = useRef(signature);
  useLayoutEffect(() => { currentSignature.current = signature; }, [signature]);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const revise = async () => {
    const issues = selectedReviewIssues(review.issues, selected);
    if (!issues.length || loading || disabled || stale || controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setError("");
    try {
      const result = await requestReviewRevision(
        { draft, issues, sourceBody, supplementaryNotes, targetAudience },
        request.signal
      );
      if (request.signal.aborted) return;
      if (currentSignature.current !== signature) {
        toast.message("稿件或来源已更新，本次修改未应用，请重新质检");
        return;
      }
      const revised = reviewRevisionDraftSchema.parse(result.draft);
      if (!Number.isInteger(result.appliedEdits) || result.appliedEdits < 0) throw new Error("修改结果格式无效，原稿未改动");
      if (result.appliedEdits === 0) {
        setError(result.notes || "未生成可应用的修改，请补充事实依据或调整选择");
        return;
      }
      onApply(revised);
      toast.success(`已按所选条目修改并保存版本，请重新质检${(result.changedImages ?? 0) > 0 ? `；${result.changedImages} 张配图方案已更新，请重新生成图片` : ""}`);
      if (result.notes) toast.message(result.notes);
    } catch (err) {
      if (!request.signal.aborted) setError(err instanceof Error ? err.message : "修改失败，原稿未改动");
    } finally {
      controller.current = null;
      if (!request.signal.aborted) setLoading(false);
    }
  };

  return <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 text-sm" aria-label="质检修改">
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-medium">质检结果 · {review.score} 分</span>
      <span className="text-xs text-slate-500">{new Date(review.createdAt).toLocaleString("zh-CN")}</span>
    </div>
    {stale ? <p className="text-amber-700">稿件已更新或此结果未绑定原稿，仅供参考。请重新质检后选择修改项。</p> : null}
    {review.issues.length ? <>
      <p className="text-xs text-slate-500">仅修改勾选项并保存版本，修改后需重新质检。配图方案有改动时需重新生成对应图片。</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={loading || disabled || stale} onClick={() => setSelected(review.issues.flatMap((item, i) => item.severity === "high" ? [i] : []))}>仅选必须改</Button>
        <Button size="sm" variant="outline" disabled={loading || disabled || stale} onClick={() => setSelected(review.issues.map((_, i) => i))}>全选</Button>
        <Button size="sm" variant="outline" disabled={loading || disabled || stale} onClick={() => setSelected([])}>清空选择</Button>
      </div>
      <ul className="space-y-2">{review.issues.map((issue, index) => <li key={index} className="rounded-md border bg-slate-50 p-3">
        <label className="flex cursor-pointer items-start gap-2">
          <Checkbox aria-label={`修改第 ${index + 1} 项：${issue.dimension}`} checked={selected.includes(index)} disabled={loading || disabled || stale}
            onCheckedChange={checked => setSelected(current => checked ? [...new Set([...current, index])] : current.filter(i => i !== index))} />
          <span className="space-y-1">
            <span className="flex flex-wrap items-center gap-2"><span className="font-medium">{issue.dimension}</span><Badge variant={issue.severity === "high" ? "destructive" : "secondary"}>{issue.severity === "high" ? "必须改" : issue.severity === "medium" ? "建议改" : "可选"}</Badge></span>
            <span className="block text-slate-600">{issue.suggestion}</span>
          </span>
        </label>
      </li>)}</ul>
      {error ? <p role="alert" className="text-rose-700">{error}</p> : null}
      <Button disabled={!selected.length || loading || disabled || stale} onClick={() => void revise()}>{loading ? "按质检修改中…" : `修改所选 ${selected.length} 项`}</Button>
    </> : <p className="text-slate-600">本次质检未发现明显问题。</p>}
  </section>;
}
