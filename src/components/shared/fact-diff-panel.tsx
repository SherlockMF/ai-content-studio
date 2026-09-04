"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FactDiffReport } from "@/lib/fact-diff";
import { cn } from "@/lib/utils";

interface FactDiffPanelProps {
  report: FactDiffReport | null;
  acknowledged?: boolean;
  onAcknowledge?: () => void;
}

export function FactDiffPanel({ report, acknowledged, onAcknowledge }: FactDiffPanelProps) {
  if (!report) return null;

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-3 text-sm",
        report.blocking && !acknowledged
          ? "border-amber-300 bg-amber-50"
          : report.items.length === 0
            ? "border-emerald-200 bg-emerald-50/50"
            : "border-slate-200 bg-white"
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-medium text-slate-800">事实核对</span>
        <Badge variant={report.blocking && !acknowledged ? "destructive" : "secondary"}>
          {report.blocking && !acknowledged ? "需确认" : report.items.length === 0 ? "通过" : "有提示"}
        </Badge>
        {acknowledged ? <Badge variant="outline">已人工确认</Badge> : null}
      </div>
      <p className="text-xs text-slate-600">{report.summary}</p>
      {report.items.length > 0 ? (
        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-700">
          {report.items.slice(0, 12).map((item, index) => (
            <li key={`${item.message}-${index}`}>
              {item.severity === "critical" ? "🔴" : "⚠️"} {item.message}
            </li>
          ))}
        </ul>
      ) : null}
      {report.blocking && !acknowledged && onAcknowledge ? (
        <Button type="button" size="sm" variant="outline" className="mt-3" onClick={onAcknowledge}>
          我已核对，确认无误
        </Button>
      ) : null}
    </div>
  );
}
