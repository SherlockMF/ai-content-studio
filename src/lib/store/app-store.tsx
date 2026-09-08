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
import { allocateNextWeekday, applyScheduleWithCascade, remapCascadeSchedules } from "@/lib/schedule";
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
  /** 自动分配下一个空闲工作日并写入排期，返回 scheduledAt */
  scheduleContent: (item: Omit<ContentItem, "scheduledAt"> & { scheduledAt?: string | null }) => string;
  addVersion: (version: ContentVersion) => void;
  setReviews: (value: ContentReview[]) => void;
  addReview: (review: ContentReview) => void;
  replaceState: (value: AppState) => void;
}

export interface AppState {
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
        setState((prev) => ({
          ...prev,
          topics: prev.topics.filter((topic) => topic.id !== id),
        })),
      addTopics: (items) =>
        setState((prev) => ({ ...prev, topics: [...items, ...prev.topics] })),
      upsertContent: (item) =>
        setState((prev) => {
          const exists = prev.contentItems.some((c) => c.id === item.id);
          return {
            ...prev,
            contentItems: exists
              ? prev.contentItems.map((c) => (c.id === item.id ? item : c))
              : [item, ...prev.contentItems],
          };
        }),
      deleteContent: (ids, options) =>
        setState((prev) => {
          const idSet = new Set(ids);
          const cascadeSchedule = options?.cascadeSchedule !== false;
          const includeLinked = options?.includeLinkedPlatforms !== false;
          let removing = new Set(idSet);
          if (includeLinked) {
            const topicIds = new Set(
              prev.contentItems.filter((item) => idSet.has(item.id)).map((item) => item.topicId)
            );
            for (const item of prev.contentItems) {
              if (topicIds.has(item.topicId)) removing.add(item.id);
            }
          }
          const remaining = prev.contentItems.filter((item) => !removing.has(item.id));
          return {
            ...prev,
            contentItems: cascadeSchedule ? remapCascadeSchedules(remaining) : remaining,
            versions: prev.versions.filter((version) => !removing.has(version.contentItemId)),
            reviews: prev.reviews.filter((review) => !removing.has(review.contentItemId)),
          };
        }),
      setContentSchedule: (id, dateKey, options) =>
        setState((prev) => {
          const cascade = options?.cascade !== false;
          if (!cascade) {
            return {
              ...prev,
              contentItems: prev.contentItems.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      scheduledAt: dateKey
                        ? new Date(`${dateKey}T12:00:00`).toISOString()
                        : null,
                      updatedAt: new Date().toISOString(),
                    }
                  : item
              ),
            };
          }
          return {
            ...prev,
            contentItems: applyScheduleWithCascade(prev.contentItems, {
              lockedId: id,
              lockedDateKey: dateKey,
            }),
          };
        }),
      scheduleContent: (item) => {
        let scheduledAt = "";
        setState((prev) => {
          scheduledAt = allocateNextWeekday(prev.contentItems);
          const nextItem: ContentItem = {
            ...item,
            scheduledAt,
          };
          const exists = prev.contentItems.some((c) => c.id === nextItem.id);
          return {
            ...prev,
            contentItems: exists
              ? prev.contentItems.map((c) => (c.id === nextItem.id ? nextItem : c))
              : [nextItem, ...prev.contentItems],
          };
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
