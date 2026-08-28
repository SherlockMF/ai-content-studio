"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KnowledgeReferencePicker } from "@/components/shared/knowledge-reference-picker";
import { withLLMPayload } from "@/lib/ai/llm-settings";
import { DEFAULT_SECTIONS } from "@/lib/mock-data";
import { useAppStore } from "@/lib/store/app-store";
import { HotspotItem, HotspotSnapshot } from "@/lib/hotspots/types";
import { ContentSection, KnowledgeReference, Topic, TopicDirection } from "@/types/domain";
import { cn } from "@/lib/utils";

function formatTime(value?: string) {
  if (!value) return "未抓取";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString("zh-CN", { hour12: false });
}

function normalizeSection(value: string): ContentSection {
  return DEFAULT_SECTIONS.includes(value as ContentSection)
    ? (value as ContentSection)
    : "AI 通识";
}

export function TopicWorkbench() {
  const router = useRouter();
  const {
    publishVoice,
    materials,
    topics,
    addTopics,
    upsertContent,
    addVersion,
  } = useAppStore();

  const [snapshot, setSnapshot] = useState<HotspotSnapshot | null>(null);
  const [loadingHotspots, setLoadingHotspots] = useState(false);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [directions, setDirections] = useState<TopicDirection[]>([]);
  const [leverageAngle, setLeverageAngle] = useState("");
  const [selectedDirectionId, setSelectedDirectionId] = useState<string | null>(null);
  const [loadingDirections, setLoadingDirections] = useState(false);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [knowledgeReferences, setKnowledgeReferences] = useState<KnowledgeReference[]>([]);

  const selectedHotspot = useMemo(
    () => snapshot?.items.find((item) => item.id === selectedHotspotId) ?? null,
    [snapshot, selectedHotspotId]
  );
  const selectedDirection = directions.find((item) => item.id === selectedDirectionId) ?? null;
  const knowledgeQuery = [
    selectedHotspot?.title,
    selectedHotspot?.summary,
    selectedDirection?.title,
    selectedDirection?.coreViewpoint,
    selectedDirection?.angle,
  ].filter(Boolean).join("\n");

  const loadCachedHotspots = async () => {
    const res = await fetch("/api/hotspots");
    const json = await res.json();
    if (json.snapshot) {
      setSnapshot(json.snapshot);
      if (!selectedHotspotId && json.snapshot.items[0]) {
        setSelectedHotspotId(json.snapshot.items[0].id);
      }
    }
  };

  const refreshHotspots = async () => {
    setLoadingHotspots(true);
    try {
      const res = await fetch("/api/hotspots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRefresh: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "热点抓取失败");
      setSnapshot(json.snapshot);
      setDirections([]);
      setLeverageAngle("");
      setSelectedDirectionId(null);
      if (json.snapshot.items[0]) setSelectedHotspotId(json.snapshot.items[0].id);
      toast.success(`已更新 ${json.snapshot.items.length} 条 AI 相关热点`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "热点抓取失败");
    } finally {
      setLoadingHotspots(false);
    }
  };

  const generateDirections = async () => {
    if (!selectedHotspot) {
      toast.error("请先选择一条热点");
      return;
    }
    setLoadingDirections(true);
    try {
      const res = await fetch("/api/ai/research-directions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withLLMPayload({
            voice: publishVoice,
            materials,
            knowledgeReferences,
            hotspot: selectedHotspot,
          })
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "方向生成失败");
      const nextDirections: TopicDirection[] = (json.directions ?? []).map(
        (item: Omit<TopicDirection, "id" | "hotspotId" | "leverageAngle">, index: number) => ({
          id: `direction_${Date.now()}_${index}`,
          hotspotId: selectedHotspot.id,
          leverageAngle: json.leverageAngle,
          ...item,
          section: normalizeSection(item.section),
        })
      );
      setDirections(nextDirections);
      setLeverageAngle(json.leverageAngle ?? "");
      setSelectedDirectionId(nextDirections[0]?.id ?? null);
      setKnowledgeReferences([]);
      toast.success(`已生成 ${nextDirections.length} 个话题方向`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "方向生成失败");
    } finally {
      setLoadingDirections(false);
    }
  };

  const generateArticle = async () => {
    if (!selectedHotspot || !selectedDirection) {
      toast.error("请先选择热点和话题方向");
      return;
    }
    setLoadingArticle(true);
    try {
      const topicId = `topic_${Date.now()}`;
      const topic: Topic = {
        id: topicId,
        workspaceId: "ws_demo",
        title: selectedDirection.title,
        coreViewpoint: selectedDirection.coreViewpoint,
        targetAudience: selectedDirection.targetAudience,
        painPoint: selectedDirection.angle,
        section: selectedDirection.section,
        platform: ["wechat"],
        contentGoal: "建立专业信任",
        recommendedFormat: "公众号图文",
        openingHook: selectedDirection.openingHook,
        scheduled: false,
        createdAt: new Date().toISOString(),
        hotspotId: selectedHotspot.id,
        directionId: selectedDirection.id,
        hotspotTitle: selectedHotspot.title,
        outline: selectedDirection.outline,
      };

      const res = await fetch("/api/ai/wechat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withLLMPayload({
            voice: publishVoice,
            materials,
            knowledgeReferences,
            topic,
            hotspot: {
              title: selectedHotspot.title,
              url: selectedHotspot.url,
              summary: selectedHotspot.summary,
            },
            direction: selectedDirection,
          })
        ),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "图文生成失败");

      addTopics([topic]);
      const contentId = `content_${Date.now()}`;
      upsertContent({
        id: contentId,
        workspaceId: "ws_demo",
        topicId,
        platform: "wechat",
        source: "ai",
        title: result.title,
        digest: result.digest,
        coverCopy: result.coverCopy,
        body: result.body,
        cta: result.cta,
        status: "AI 草稿",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scheduledAt: null,
        publishedAt: null,
      });
      addVersion({
        id: `version_${Date.now()}`,
        contentItemId: contentId,
        versionNumber: 1,
        title: result.title,
        body: result.body,
        changeSource: "ai_generate",
        createdAt: new Date().toISOString(),
      });
      toast.success("完整图文已生成，正在跳转稿件页");
      router.push(`/content?topicId=${topicId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "图文生成失败");
    } finally {
      setLoadingArticle(false);
    }
  };

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
          <Button variant="outline" onClick={loadCachedHotspots} disabled={loadingHotspots}>
            读取缓存
          </Button>
          <Button onClick={refreshHotspots} disabled={loadingHotspots}>
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
                      onSelect={() => {
                        setSelectedHotspotId(item.id);
                        setDirections([]);
                        setSelectedDirectionId(null);
                        setLeverageAngle("");
                        setKnowledgeReferences([]);
                      }}
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
            disabled={!selectedHotspot || loadingDirections}
            onClick={generateDirections}
          >
            {loadingDirections ? "生成中..." : "生成三个话题方向"}
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

      {directions.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">三个话题方向</CardTitle>
            {leverageAngle ? (
              <p className="text-sm text-slate-600">蹭热点角度：{leverageAngle}</p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-3">
              {directions.map((direction) => (
                <button
                  key={direction.id}
                  type="button"
                  onClick={() => {
                    setSelectedDirectionId(direction.id);
                    setKnowledgeReferences([]);
                  }}
                  className={cn(
                    "rounded-xl border p-4 text-left transition hover:bg-slate-50",
                    selectedDirectionId === direction.id
                      ? "border-slate-900 bg-slate-50"
                      : "border-slate-200"
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
              onChange={setKnowledgeReferences}
            />
            <div className="flex flex-wrap gap-2">
              <Button disabled={!selectedDirection || loadingArticle} onClick={generateArticle}>
                {loadingArticle ? "生成中..." : "生成完整公众号图文"}
              </Button>
              <Button variant="outline" disabled={loadingDirections} onClick={generateDirections}>
                换一批方向
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">已有选题（{topics.length}）</CardTitle>
        </CardHeader>
        <CardContent>
          {topics.length === 0 ? (
            <p className="text-sm text-slate-500">从热点研究生成后，选题会自动出现在这里。</p>
          ) : (
            <p className="text-sm text-slate-500">下方列表展示已保存选题，可继续排期或去稿件页编辑。</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HotspotCard({
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
