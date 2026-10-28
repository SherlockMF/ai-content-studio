"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { collectPublishedArticles, type TopicDeduplication } from "@/lib/ai/published-topic-check";
import {
  fetchCachedHotspots,
  refreshHotspotSnapshot,
  requestResearchDirections,
  requestWechatArticle,
} from "@/lib/api-client";
import type { HotspotSnapshot } from "@/lib/hotspots/types";
import { createId } from "@/lib/ids";
import { generateWechatMedia } from "@/lib/illustrations/wechat-media-client";
import { DEFAULT_SECTIONS } from "@/lib/defaults";
import { useContentState, useStoreActions, useStoreHydrated, useWorkspaceState } from "@/lib/store/app-store";
import type {
  ContentItem,
  ContentSection,
  KnowledgeReference,
  Topic,
  TopicDirection,
} from "@/types/domain";

function normalizeSection(value: string): ContentSection {
  return DEFAULT_SECTIONS.includes(value as ContentSection) ? (value as ContentSection) : "AI 通识";
}

/** 热点 → 话题方向 → 公众号图文 的研究流程状态 */
export function useTopicWorkflow() {
  const router = useRouter();
  const { publishVoice, materials, topics } = useWorkspaceState();
  const { contentItems } = useContentState();
  const storeHydrated = useStoreHydrated();
  const { addTopics, upsertContent, addVersion } = useStoreActions();

  const [snapshot, setSnapshot] = useState<HotspotSnapshot | null>(null);
  const [loadingHotspots, setLoadingHotspots] = useState(false);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [directions, setDirections] = useState<TopicDirection[]>([]);
  const [deduplication, setDeduplication] = useState<TopicDeduplication | null>(null);
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
  ]
    .filter(Boolean)
    .join("\n");

  const clearDirections = () => {
    setDirections([]);
    setDeduplication(null);
    setLeverageAngle("");
    setSelectedDirectionId(null);
  };

  const loadCachedHotspots = async () => {
    try {
      const { snapshot: cached } = await fetchCachedHotspots();
      if (!cached) return;
      setSnapshot(cached);
      if (!selectedHotspotId && cached.items[0]) setSelectedHotspotId(cached.items[0].id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "热点读取失败");
    }
  };

  const refreshHotspots = async () => {
    setLoadingHotspots(true);
    try {
      const { snapshot: next } = await refreshHotspotSnapshot();
      setSnapshot(next);
      clearDirections();
      if (next.items[0]) setSelectedHotspotId(next.items[0].id);
      toast.success(`已更新 ${next.items.length} 条 AI 相关热点`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "热点抓取失败");
    } finally {
      setLoadingHotspots(false);
    }
  };

  const selectHotspot = (hotspotId: string) => {
    setSelectedHotspotId(hotspotId);
    clearDirections();
    setKnowledgeReferences([]);
  };

  const selectDirection = (directionId: string) => {
    setSelectedDirectionId(directionId);
    setKnowledgeReferences([]);
  };

  const generateDirections = async () => {
    if (!storeHydrated) return;
    if (!selectedHotspot) {
      toast.error("请先选择一条热点");
      return;
    }
    setLoadingDirections(true);
    setDirections([]);
    setSelectedDirectionId(null);
    setDeduplication(null);
    try {
      const json = await requestResearchDirections({
        voice: publishVoice,
        materials,
        knowledgeReferences,
        hotspot: selectedHotspot,
        publishedArticles: collectPublishedArticles(contentItems, topics),
      });
      const batchId = createId("direction");
      const nextDirections: TopicDirection[] = (json.directions ?? []).map((item, index) => ({
        id: `${batchId}_${index}`,
        hotspotId: selectedHotspot.id,
        leverageAngle: json.leverageAngle,
        ...item,
        section: normalizeSection(item.section),
      }));
      setDirections(nextDirections);
      setDeduplication(json.deduplication ?? null);
      setLeverageAngle(json.leverageAngle ?? "");
      setSelectedDirectionId(nextDirections[0]?.id ?? null);
      setKnowledgeReferences([]);
      if (nextDirections.length) toast.success(`去重后保留 ${nextDirections.length} 个话题方向`);
      else toast.info("本批方向与已发布内容重复，请换一批或选择其他热点");
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
      const topicId = createId("topic");
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

      const result = await requestWechatArticle(
        {
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
        },
        "图文生成失败"
      );

      addTopics([topic]);
      const contentId = createId("content");
      const now = new Date().toISOString();
      let generatedContent: ContentItem = {
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
        coverPromptPack: result.coverVariants?.length
          ? { summary: result.coverSummary, variants: result.coverVariants }
          : undefined,
        status: "AI 草稿",
        createdAt: now,
        updatedAt: now,
        scheduledAt: null,
        publishedAt: null,
      };
      upsertContent(generatedContent);
      addVersion({
        id: createId("version"),
        contentItemId: contentId,
        versionNumber: 1,
        title: result.title,
        body: result.body,
        changeSource: "ai_generate",
        createdAt: now,
      });
      toast.message("文案已保存，正在生成封面和正文配图…");
      try {
        const mediaResult = await generateWechatMedia({
          title: result.title,
          body: result.body,
          onUpdate: (body) => {
            generatedContent = { ...generatedContent, body, updatedAt: new Date().toISOString() };
            upsertContent(generatedContent);
          },
        });
        if (mediaResult.failures.length) {
          toast.error(`文案已保存，${mediaResult.failures.length} 张配图未完成，可在稿件页补齐`);
        } else {
          toast.success("图文和配图已生成，正在跳转稿件页");
        }
      } catch (error) {
        toast.error(`文案已保存，配图未完成：${error instanceof Error ? error.message : "生成失败"}`);
      }
      router.push(`/content?topicId=${topicId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "图文生成失败");
    } finally {
      setLoadingArticle(false);
    }
  };

  return {
    storeHydrated,
    topicCount: topics.length,
    snapshot,
    loadingHotspots,
    selectedHotspotId,
    selectedHotspot,
    directions,
    deduplication,
    leverageAngle,
    selectedDirectionId,
    selectedDirection,
    loadingDirections,
    loadingArticle,
    knowledgeReferences,
    setKnowledgeReferences,
    knowledgeQuery,
    loadCachedHotspots,
    refreshHotspots,
    selectHotspot,
    selectDirection,
    generateDirections,
    generateArticle,
  };
}
