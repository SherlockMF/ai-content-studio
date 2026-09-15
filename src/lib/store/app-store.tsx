"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  DEMO_CONTENT_ITEMS,
  DEMO_MATERIALS,
  DEMO_PUBLISH_VOICE,
  DEMO_REVIEWS,
  DEMO_TOPICS,
  DEMO_VERSIONS,
} from "@/lib/mock-data";
import { planAutomaticSchedule } from "@/lib/auto-schedule";
import { applyScheduleWithCascade, remapCascadeSchedules } from "@/lib/schedule";
import { normalizeContentStatus } from "@/lib/content-status";
import { normalizeXiaohongshuContent } from "@/lib/xiaohongshu/content";
import {
  inferContentSource,
  maybeRestoreSeedContent,
  restoreOrphanedXiaohongshuFromVersions,
  syncBuiltinSeedArticles,
  CURRENT_SEED_FINGERPRINT,
} from "@/lib/seed/restore";
import {
  ContentItem,
  ContentReview,
  ContentVersion,
  MaterialItem,
  PublishVoice,
  Topic,
} from "@/types/domain";

interface AppStoreValue {
  publishVoice: PublishVoice;
  materials: MaterialItem[];
  topics: Topic[];
  contentItems: ContentItem[];
  reviews: ContentReview[];
  versions: ContentVersion[];
  autoScheduleEnabled?: boolean;
  setAutoScheduleEnabled: (enabled: boolean) => void;
  replanSchedule: () => void;
  unlockContentSchedule: (id: string) => void;
  /** localStorage 已恢复，可与服务端首屏安全分叉 */
  storeHydrated: boolean;
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
}

export interface AppState {
  autoScheduleEnabled?: boolean;
  publishVoice: PublishVoice;
  materials: MaterialItem[];
  topics: Topic[];
  contentItems: ContentItem[];
  reviews: ContentReview[];
  versions: ContentVersion[];
  /** 种子稿指纹，变更后触发本地数据同步 */
  seedFingerprint?: string;
  seedVersion?: number;
}

function replanIfEnabled(state: AppState): AppState {
  return state.autoScheduleEnabled ? { ...state, ...planAutomaticSchedule(state.contentItems, state.topics) } : state;
}

const STORAGE_KEY = "ai-content-publishing-workbench-v3";

const AppStoreContext = createContext<AppStoreValue | null>(null);

function seedData(): AppState {
  return {
    publishVoice: DEMO_PUBLISH_VOICE,
    materials: DEMO_MATERIALS,
    topics: DEMO_TOPICS,
    contentItems: DEMO_CONTENT_ITEMS,
    reviews: DEMO_REVIEWS,
    versions: DEMO_VERSIONS,
  };
}

function migrateState(parsed: Partial<AppState>): AppState {
  const base = { ...seedData(), ...parsed } as AppState;
  let state: AppState = {
    ...base,
    reviews: (base.reviews ?? []).map((review) => ({
      ...review,
      issues: Array.isArray(review.issues) ? review.issues : [],
      score: typeof review.score === "number" ? review.score : 0,
    })),
    contentItems: base.contentItems.map((item) =>
      normalizeXiaohongshuContent(
        maybeRestoreSeedContent({
          ...item,
          source: inferContentSource(item),
          status: normalizeContentStatus(item.status),
        })
      )
    ),
  };

  state = {
    ...state,
    contentItems: restoreOrphanedXiaohongshuFromVersions({
      contentItems: state.contentItems,
      versions: state.versions ?? [],
    }).map(normalizeXiaohongshuContent),
  };

  if ((parsed.seedFingerprint ?? "") !== CURRENT_SEED_FINGERPRINT) {
    const synced = syncBuiltinSeedArticles(state);
    state = {
      ...state,
      ...synced,
      seedFingerprint: CURRENT_SEED_FINGERPRINT,
    };
    state = {
      ...state,
      contentItems: restoreOrphanedXiaohongshuFromVersions({
        contentItems: state.contentItems,
        versions: state.versions ?? [],
      }).map(normalizeXiaohongshuContent),
    };
  }

  return state;
}

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => seedData());
  const [storeHydrated, setStoreHydrated] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<AppState>;
        if (parsed.publishVoice && parsed.materials) {
          // Hydrate from localStorage after mount; initial render uses seedData for SSR parity.
          // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage hydration
          setState(migrateState(parsed));
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setStoreHydrated(true);
  }, []);

  useEffect(() => {
    if (!storeHydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, storeHydrated]);

  const value = useMemo<AppStoreValue>(
    () => ({
      ...state,
      storeHydrated,
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
        const preview = planAutomaticSchedule(
          [...state.contentItems.filter(c => c.id !== item.id), { ...item, scheduleMode: "auto" }], state.topics);
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
    }),
    [state, storeHydrated]
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const context = useContext(AppStoreContext);
  if (!context) {
    throw new Error("useAppStore must be used in AppStoreProvider");
  }
  return context;
}
