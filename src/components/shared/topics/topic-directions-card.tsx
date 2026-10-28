"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KnowledgeReferencePicker } from "@/components/shared/knowledge-reference-picker";
import { cn } from "@/lib/utils";
import type { KnowledgeReference, TopicDirection } from "@/types/domain";

export function TopicDirectionsCard({
  directions,
  leverageAngle,
  selectedDirectionId,
  onSelectDirection,
  knowledgeQuery,
  knowledgeReferences,
  onKnowledgeChange,
  canGenerateArticle,
  loadingArticle,
  loadingDirections,
  onGenerateArticle,
  onRegenerateDirections,
}: {
  directions: TopicDirection[];
  leverageAngle: string;
  selectedDirectionId: string | null;
  onSelectDirection: (directionId: string) => void;
  knowledgeQuery: string;
  knowledgeReferences: KnowledgeReference[];
  onKnowledgeChange: (value: KnowledgeReference[]) => void;
  canGenerateArticle: boolean;
  loadingArticle: boolean;
  loadingDirections: boolean;
  onGenerateArticle: () => void;
  onRegenerateDirections: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">话题方向（{directions.length}）</CardTitle>
        {leverageAngle ? <p className="text-sm text-slate-600">蹭热点角度：{leverageAngle}</p> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-3">
          {directions.map((direction) => (
            <button
              key={direction.id}
              type="button"
              onClick={() => onSelectDirection(direction.id)}
              className={cn(
                "rounded-xl border p-4 text-left transition hover:bg-slate-50",
                selectedDirectionId === direction.id ? "border-slate-900 bg-slate-50" : "border-slate-200"
              )}
            >
              <p className="text-sm font-medium">{direction.title}</p>
              <p className="mt-2 text-xs text-slate-600">{direction.angle}</p>
              <p className="mt-2 text-xs text-slate-500">为什么现在写：{direction.whyNow}</p>
              <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-slate-500">
                {direction.outline.slice(0, 4).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>
        <KnowledgeReferencePicker
          query={knowledgeQuery}
          value={knowledgeReferences}
          onChange={onKnowledgeChange}
        />
        <div className="flex flex-wrap gap-2">
          <Button disabled={!canGenerateArticle || loadingArticle} onClick={onGenerateArticle}>
            {loadingArticle ? "生成中..." : "生成完整公众号图文"}
          </Button>
          <Button variant="outline" disabled={loadingDirections} onClick={onRegenerateDirections}>
            换一批方向
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
