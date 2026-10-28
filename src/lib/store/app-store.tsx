"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { fillXiaohongshuImagePlan, countMissingXiaohongshuImages } from "@/lib/xiaohongshu/generate-images";
import { mergeGeneratedImage } from "@/lib/xiaohongshu/merge-generated-image";
import { planAutomaticSchedule } from "@/lib/auto-schedule";
import { createUniqueId } from "@/lib/ids";
import { applyScheduleWithCascade, remapCascadeSchedules } from "@/lib/schedule";
import {
  applyProjectDraftOverlays,
  parseStoredState,
  seedData,
  STORAGE_KEY,
  type AppState,
} from "./hydrate";
import type { ContentItem, MaterialItem, PublishVoice, Topic, ContentVersion, ContentReview } from "@/types/domain";

export type { AppState };

export type ImageJobs = Record<string, { running: boolean; progress: string }>;

/** 稿件、版本、质检与排期开关：编辑时高频变化 */
export type ContentState = Pick<AppState, "contentItems" | "versions" | "reviews" | "autoScheduleEnabled">;
/** 人设、素材、选题：低频变化 */
export type WorkspaceState = Pick<AppState, "publishVoice" | "materials" | "topics">;

export interface StoreActions {
  generateXiaohongshuImages: (content: ContentItem, onlyMissing: boolean) => Promise<void>;
  setAutoScheduleEnabled: (enabled: boolean) => void;
  replanSchedule: () => void;
  unlockContentSchedule: (id: string) => void;
  updatePublishVoice: (patch: Partial<PublishVoice>) => void;
  upsertMaterial: (item: MaterialItem) => void;
  toggleMaterial: (id: string) => void;
  deleteMaterial: (id: string) => void;
  deleteTopic: (id: string) => void;
  addTopics: (items: Topic[]) => void;
  upsertContent: (item: ContentItem) => void;
  /** 删除稿件；默认同时删除同选题下关联平台稿，并顺延剩余排期 */
  deleteContent: (
    ids: string[],
    options?: { cascadeSchedule?: boolean; includeLinkedPlatforms?: boolean }
  ) => void;
  /** 设置排期日；默认把同日及之后的未发布稿往后顺延 */
  setContentSchedule: (
    id: string,
    dateKey: string | null,
    options?: { cascade?: boolean }
  ) => void;
  /** 根据题材与已有档期分配工作日，返回 scheduledAt */
  scheduleContent: (item: Omit<ContentItem, "scheduledAt"> & { scheduledAt?: string | null }) => string;
  addVersion: (version: ContentVersion) => void;
  setReviews: (value: ContentReview[]) => void;
  addReview: (review: ContentReview) => void;
  replaceState: (value: AppState) => void;
  /** 当前完整快照（与持久化内容一致），用于备份 */
  getSnapshot: () => AppState;
}

const PERSIST_DELAY_MS = 300;

function replanIfEnabled(state: AppState): AppState {
  return state.autoScheduleEnabled ? { ...state, ...planAutomaticSchedule(state.contentItems, state.topics) } : state;
}

function writeState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function fetchOverlayText(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  return response.ok ? response.text() : null;
}

const ContentStateContext = createContext<ContentState | null>(null);
const WorkspaceStateContext = createContext<WorkspaceState | null>(null);
const ImageJobsContext = createContext<ImageJobs | null>(null);
/** localStorage 已恢复，可与服务端首屏安全分叉 */
const HydratedContext = createContext<boolean | null>(null);
const ActionsContext = createContext<StoreActions | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => seedData());
  const [storeHydrated, setStoreHydrated] = useState(false);
  const [imageJobs, setImageJobs] = useState<ImageJobs>({});
  const imageTasks = useRef(new Map<string, Promise<void>>());
  const stateRef = useRef(state);

  useLayoutEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { state: restored, corrupt } = parseStoredState(window.localStorage.getItem(STORAGE_KEY));
      if (corrupt) window.localStorage.removeItem(STORAGE_KEY);
      const next = await applyProjectDraftOverlays(restored, fetchOverlayText);
      if (cancelled) return;
      setState(next);
      setStoreHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storeHydrated) return;
    const timer = window.setTimeout(() => writeState(state), PERSIST_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state, storeHydrated]);

  useEffect(() => {
    if (!storeHydrated) return;
    const flush = () => writeState(stateRef.current);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [storeHydrated]);

  const actions = useMemo<StoreActions>(
    () => ({
      generateXiaohongshuImages: (content, onlyMissing) => {
        const pending = imageTasks.current.get(content.id);
        if (pending) return pending;
        if (!content.xiaohongshu) return Promise.resolve();
        const data = content.xiaohongshu;
        const updateProgress = (running: boolean, progress: string) => setImageJobs(prev => ({ ...prev, [content.id]: { running, progress } }));
        const task = (async () => {
          updateProgress(true, "准备生图…切换稿件后会继续");
          try {
            const imagePlan = await fillXiaohongshuImagePlan(data.imagePlan, {
              visualDirection: data.visualDirection, onlyMissing,
              onProgress: event => updateProgress(true, event.status === "error"
                ? `图 ${event.index} 失败，将继续生成其余图片`
                : `生图 ${event.index}/${event.total} · 切换稿件后继续`),
              onImage: image => setState(prev => ({ ...prev,
                contentItems: prev.contentItems.map(item => mergeGeneratedImage(item, content, image)),
              })),
            });
            const now = new Date().toISOString();
            const versionId = createUniqueId("version_images");
            setState(prev => {
              const saved = prev.contentItems.find(item => item.id === content.id);
              if (!saved?.xiaohongshu) return prev;
              return { ...prev, versions: [{ id: versionId, contentItemId: saved.id,
                versionNumber: Math.max(0, ...prev.versions.filter(v => v.contentItemId === saved.id).map(v => v.versionNumber)) + 1,
                title: saved.title, body: saved.body, digest: saved.digest, coverCopy: saved.coverCopy,
                cta: saved.cta, supplementaryNotes: saved.supplementaryNotes, xiaohongshu: saved.xiaohongshu,
                changeSource: "ai_rewrite", createdAt: now,
              }, ...prev.versions] };
            });
            const missing = countMissingXiaohongshuImages(imagePlan);
            const message = missing ? `仍有 ${missing} 张未生成，可补全重试` : "配图生成完成，结果已按原图片方案保存";
            updateProgress(false, message);
            if (missing) toast.error(`「${content.title}」${message}`);
            else toast.success(`「${content.title}」${message}`);
          } catch (error) {
            const message = error instanceof Error ? error.message : "配图生成失败";
            updateProgress(false, message);
            toast.error(`「${content.title}」${message}`);
          } finally { imageTasks.current.delete(content.id); }
        })();
        imageTasks.current.set(content.id, task);
        return task;
      },
      setAutoScheduleEnabled: (enabled) => setState(prev => replanIfEnabled({ ...prev, autoScheduleEnabled: enabled })),
      replanSchedule: () => setState(prev => replanIfEnabled({ ...prev, autoScheduleEnabled: true })),
      unlockContentSchedule: (id) => setState(prev => replanIfEnabled({ ...prev, autoScheduleEnabled: true,
        contentItems: prev.contentItems.map(item => item.id === id ? { ...item, scheduleMode: "auto", scheduleReason: undefined } : item) })),
      updatePublishVoice: (patch) =>
        setState((prev) => ({
          ...prev,
          publishVoice: { ...prev.publishVoice, ...patch },
        })),
      upsertMaterial: (item) =>
        setState((prev) => {
          const exists = prev.materials.some((m) => m.id === item.id);
          return {
            ...prev,
            materials: exists
              ? prev.materials.map((m) => (m.id === item.id ? item : m))
              : [item, ...prev.materials],
          };
        }),
      toggleMaterial: (id) =>
        setState((prev) => ({
          ...prev,
          materials: prev.materials.map((m) =>
            m.id === id ? { ...m, enabled: !m.enabled, updatedAt: new Date().toISOString() } : m
          ),
        })),
      deleteMaterial: (id) =>
        setState((prev) => ({
          ...prev,
          materials: prev.materials.filter((material) => material.id !== id),
        })),
      deleteTopic: (id) =>
        setState((prev) => replanIfEnabled({
          ...prev,
          topics: prev.topics.filter((topic) => topic.id !== id),
        })),
      addTopics: (items) =>
        setState((prev) => replanIfEnabled({ ...prev, topics: [...items, ...prev.topics.filter(topic => !items.some(item => item.id === topic.id))] })),
      upsertContent: (item) =>
        setState((prev) => {
          const existing = prev.contentItems.find(c => c.id === item.id);
          const merged = existing ? { ...item,
            scheduledAt: existing.scheduledAt,
            scheduleMode: existing.scheduleMode, scheduleReason: existing.scheduleReason } : item;
          const next = { ...prev, contentItems: existing
            ? prev.contentItems.map(c => c.id === item.id ? merged : c)
            : [merged, ...prev.contentItems] };
          return !existing || existing.status !== item.status ? replanIfEnabled(next) : next;
        }),
      deleteContent: (ids, options) =>
        setState((prev) => {
          const idSet = new Set(ids);
          const cascadeSchedule = options?.cascadeSchedule !== false;
          const includeLinked = options?.includeLinkedPlatforms !== false;
          const removing = new Set(idSet);
          if (includeLinked) {
            const topicIds = new Set(
              prev.contentItems.filter((item) => idSet.has(item.id)).map((item) => item.topicId)
            );
            for (const item of prev.contentItems) {
              if (topicIds.has(item.topicId)) removing.add(item.id);
            }
          }
          const remaining = prev.contentItems.filter((item) => !removing.has(item.id));
          return replanIfEnabled({
            ...prev,
            contentItems: cascadeSchedule && !prev.autoScheduleEnabled ? remapCascadeSchedules(remaining) : remaining,
            versions: prev.versions.filter((version) => !removing.has(version.contentItemId)),
            reviews: prev.reviews.filter((review) => !removing.has(review.contentItemId)),
          });
        }),
      setContentSchedule: (id, dateKey, options) =>
        setState((prev) => {
          const marked = prev.contentItems.map(item => item.id === id ? { ...item, scheduleMode: "manual" as const, scheduleReason: "手动确定，自动排期保留此日期" } : item);
          const contentItems = options?.cascade !== false && !prev.autoScheduleEnabled
            ? applyScheduleWithCascade(marked, { lockedId: id, lockedDateKey: dateKey })
            : marked.map(item => item.id === id ? { ...item,
              scheduledAt: dateKey ? new Date(`${dateKey}T12:00:00`).toISOString() : null,
              updatedAt: new Date().toISOString() } : item);
          return replanIfEnabled({ ...prev, contentItems });
        }),
      scheduleContent: (item) => {
        const current = stateRef.current;
        const preview = planAutomaticSchedule(
          [...current.contentItems.filter(c => c.id !== item.id), { ...item, scheduleMode: "auto" }], current.topics);
        const scheduledAt = preview.contentItems.find(c => c.id === item.id)!.scheduledAt!;
        setState(prev => {
          const nextItem: ContentItem = { ...item, scheduledAt, scheduleMode: "auto" };
          const contentItems = [nextItem, ...prev.contentItems.filter(c => c.id !== item.id)];
          return { ...prev, ...planAutomaticSchedule(contentItems, prev.topics) };
        });
        return scheduledAt;
      },
      addVersion: (version) =>
        setState((prev) => ({ ...prev, versions: [version, ...prev.versions] })),
      setReviews: (reviews) => setState((prev) => ({ ...prev, reviews })),
      addReview: (review) =>
        setState((prev) => ({
          ...prev,
          reviews: [review, ...prev.reviews.filter((item) => item.id !== review.id)],
        })),
      replaceState: (value) => setState(value),
      getSnapshot: () => stateRef.current,
    }),
    []
  );

  const { contentItems, versions, reviews, autoScheduleEnabled, publishVoice, materials, topics } = state;
  const contentState = useMemo<ContentState>(
    () => ({ contentItems, versions, reviews, autoScheduleEnabled }),
    [contentItems, versions, reviews, autoScheduleEnabled]
  );
  const workspaceState = useMemo<WorkspaceState>(
    () => ({ publishVoice, materials, topics }),
    [publishVoice, materials, topics]
  );

  return (
    <ActionsContext.Provider value={actions}>
      <HydratedContext.Provider value={storeHydrated}>
        <WorkspaceStateContext.Provider value={workspaceState}>
          <ContentStateContext.Provider value={contentState}>
            <ImageJobsContext.Provider value={imageJobs}>{children}</ImageJobsContext.Provider>
          </ContentStateContext.Provider>
        </WorkspaceStateContext.Provider>
      </HydratedContext.Provider>
    </ActionsContext.Provider>
  );
}

function useRequiredContext<T>(context: React.Context<T | null>, name: string): T {
  const value = useContext(context);
  if (value === null) throw new Error(`${name} must be used in AppStoreProvider`);
  return value;
}

export function useContentState() {
  return useRequiredContext(ContentStateContext, "useContentState");
}

export function useWorkspaceState() {
  return useRequiredContext(WorkspaceStateContext, "useWorkspaceState");
}

export function useImageJobs() {
  return useRequiredContext(ImageJobsContext, "useImageJobs");
}

export function useStoreHydrated() {
  return useRequiredContext(HydratedContext, "useStoreHydrated");
}

export function useStoreActions() {
  return useRequiredContext(ActionsContext, "useStoreActions");
}
