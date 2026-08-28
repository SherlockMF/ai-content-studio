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
import { allocateNextFriday } from "@/lib/schedule";
import { inferContentSource, maybeRestoreSeedContent, syncBuiltinSeedArticles, CURRENT_SEED_FINGERPRINT } from "@/lib/seed/restore";
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
  /** 自动分配下一个空闲周五并写入排期，返回 scheduledAt */
  scheduleContent: (item: Omit<ContentItem, "scheduledAt"> & { scheduledAt?: string | null }) => string;
  addVersion: (version: ContentVersion) => void;
  setReviews: (value: ContentReview[]) => void;
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
      maybeRestoreSeedContent({
        ...item,
        source: inferContentSource(item),
      })
    ),
  };

  if ((parsed.seedFingerprint ?? "") !== CURRENT_SEED_FINGERPRINT) {
    const synced = syncBuiltinSeedArticles(state);
    state = {
      ...state,
      ...synced,
      seedFingerprint: CURRENT_SEED_FINGERPRINT,
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
      scheduleContent: (item) => {
        let scheduledAt = "";
        setState((prev) => {
          scheduledAt = allocateNextFriday(prev.contentItems);
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
