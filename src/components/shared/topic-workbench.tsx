"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KnowledgeReferencePicker } from "@/components/shared/knowledge-reference-picker";
import { HotspotCard } from "@/components/shared/topics/hotspot-card";
import { TopicDirectionsCard } from "@/components/shared/topics/topic-directions-card";
import { useTopicWorkflow } from "@/components/shared/topics/use-topic-workflow";

function formatTime(value?: string) {
  if (!value) return "未抓取";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString("zh-CN", { hour12: false });
}

export function TopicWorkbench() {
  const workflow = useTopicWorkflow();
  const {
    snapshot,
    loadingHotspots,
    selectedHotspotId,
    selectedHotspot,
    directions,
    deduplication,
    loadingDirections,
    knowledgeQuery,
    knowledgeReferences,
    setKnowledgeReferences,
  } = workflow;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">研究热点</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              聚合 AIHOT 热点榜 + 公开 RSS，按 AI 关键词过滤。更新于 {formatTime(snapshot?.fetchedAt)}
            </p>
          </div>
          <Button variant="outline" onClick={workflow.loadCachedHotspots} disabled={loadingHotspots}>
            读取缓存
          </Button>
          <Button onClick={workflow.refreshHotspots} disabled={loadingHotspots}>
            {loadingHotspots ? "抓取中..." : "抓取并比对"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {snapshot?.sourceReports?.length ? (
            <div className="flex flex-wrap gap-2">
              {snapshot.sourceReports.map((report) => (
                <Badge key={report.sourceId} variant="outline">
                  {report.sourceName} {report.status === "ok" ? report.itemCount : "失败"}
                </Badge>
              ))}
            </div>
          ) : null}
          {!snapshot?.items.length ? (
            <p className="text-sm text-slate-500">暂无热点，点击「抓取并比对」开始研究。</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">在下方区域内滚动浏览，选中后可生成话题方向。</p>
              <div className="max-h-72 overflow-y-auto rounded-xl border bg-slate-50/80 p-2">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
                  {snapshot.items.slice(0, 24).map((item) => (
                    <HotspotCard
                      key={item.id}
                      item={item}
                      active={selectedHotspotId === item.id}
                      onSelect={() => workflow.selectHotspot(item.id)}
                    />
                  ))}
                </div>
              </div>
              {selectedHotspot ? (
                <div className="rounded-lg border bg-white p-3 text-xs text-slate-600">
                  <p className="text-sm font-medium text-slate-900">{selectedHotspot.title}</p>
                  {selectedHotspot.leverageHint ? (
                    <p className="mt-1 line-clamp-2">蹭热点角度：{selectedHotspot.leverageHint}</p>
                  ) : null}
                  {selectedHotspot.summary ? (
                    <p className="mt-1 line-clamp-2 text-slate-500">{selectedHotspot.summary}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
          {selectedHotspot && directions.length === 0 ? (
            <KnowledgeReferencePicker
              query={knowledgeQuery}
              value={knowledgeReferences}
              onChange={setKnowledgeReferences}
            />
          ) : null}
          <Button
            variant="secondary"
            disabled={!workflow.storeHydrated || !selectedHotspot || loadingDirections}
            onClick={workflow.generateDirections}
          >
            {loadingDirections ? "生成并检查重复中..." : "生成三个话题方向"}
          </Button>
          <p className="text-xs text-slate-500">
            出稿风格（受众、语气）在
            <Link href="/settings#voice" className="mx-1 underline">
              设置 · 发布人设
            </Link>
            配置，不影响热点列表。
          </p>
        </CardContent>
      </Card>

      {deduplication ? (
        <div className="space-y-2 rounded-xl border p-4 text-sm" role="status">
          <p>{deduplication.checkedCount ? `已对照 ${deduplication.checkedCount} 篇已发布／归档稿件，剔除 ${deduplication.removed.length} 个重复方向。` : "暂无已发布稿件，本次未做历史比对。"}</p>
          {deduplication.removed.map((item, index) => (
            <p key={index}>「{item.title}」与「{item.publishedTitle}」重复：{item.reason}</p>
          ))}
        </div>
      ) : null}

      {directions.length ? (
        <TopicDirectionsCard
          directions={directions}
          leverageAngle={workflow.leverageAngle}
          selectedDirectionId={workflow.selectedDirectionId}
          onSelectDirection={workflow.selectDirection}
          knowledgeQuery={knowledgeQuery}
          knowledgeReferences={knowledgeReferences}
          onKnowledgeChange={setKnowledgeReferences}
          canGenerateArticle={Boolean(workflow.selectedDirection)}
          loadingArticle={workflow.loadingArticle}
          loadingDirections={loadingDirections}
          onGenerateArticle={workflow.generateArticle}
          onRegenerateDirections={workflow.generateDirections}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">已有选题（{workflow.topicCount}）</CardTitle>
        </CardHeader>
        <CardContent>
          {workflow.topicCount === 0 ? (
            <p className="text-sm text-slate-500">从热点研究生成后，选题会自动出现在这里。</p>
          ) : (
            <p className="text-sm text-slate-500">下方列表展示已保存选题，可继续排期或去稿件页编辑。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
