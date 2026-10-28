import {
  DEMO_CONTENT_ITEMS,
  DEMO_MATERIALS,
  DEMO_PUBLISH_VOICE,
  DEMO_REVIEWS,
  DEMO_TOPICS,
  DEMO_VERSIONS,
} from "@/lib/mock-data";
import { normalizeContentStatus } from "@/lib/content-status";
import { normalizeWechatLayout } from "@/lib/markdown/wechat-theme";
import { normalizeXiaohongshuContent } from "@/lib/xiaohongshu/content";
import {
  inferContentSource,
  maybeRestoreSeedContent,
  restoreOrphanedXiaohongshuFromVersions,
  syncBuiltinSeedArticles,
  CURRENT_SEED_FINGERPRINT,
} from "@/lib/seed/restore";
import {
  PROJECT_DRAFT_OVERLAYS,
  applyDraftOverlayToItems,
} from "@/lib/draft-overlays";
import type {
  ContentItem,
  ContentReview,
  ContentVersion,
  MaterialItem,
  PublishVoice,
  Topic,
} from "@/types/domain";

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
  /** 已应用过的项目草稿覆盖 id，避免每次启动重复拉取 */
  appliedOverlayIds?: string[];
}

export const STORAGE_KEY = "ai-content-publishing-workbench-v3";

export function seedData(): AppState {
  return {
    publishVoice: DEMO_PUBLISH_VOICE,
    materials: DEMO_MATERIALS,
    topics: DEMO_TOPICS,
    contentItems: DEMO_CONTENT_ITEMS,
    reviews: DEMO_REVIEWS,
    versions: DEMO_VERSIONS,
  };
}

function restoreXiaohongshu(state: AppState): AppState {
  return {
    ...state,
    contentItems: restoreOrphanedXiaohongshuFromVersions({
      contentItems: state.contentItems,
      versions: state.versions ?? [],
    }).map(normalizeXiaohongshuContent),
  };
}

export function migrateState(parsed: Partial<AppState>): AppState {
  const base = { ...seedData(), ...parsed } as AppState;
  let state = restoreXiaohongshu({
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
          ...(item.platform === "wechat" ? { wechatLayout: normalizeWechatLayout(item.wechatLayout) } : {}),
        })
      )
    ),
  });

  if ((parsed.seedFingerprint ?? "") !== CURRENT_SEED_FINGERPRINT) {
    state = restoreXiaohongshu({
      ...state,
      ...syncBuiltinSeedArticles(state),
      seedFingerprint: CURRENT_SEED_FINGERPRINT,
    });
  }

  return state;
}

/** 解析 localStorage 快照；损坏时返回 corrupt=true 让调用方清理 */
export function parseStoredState(raw: string | null): { state: AppState; corrupt: boolean } {
  if (!raw) return { state: seedData(), corrupt: false };
  try {
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (parsed.publishVoice && parsed.materials) {
      return { state: migrateState(parsed), corrupt: false };
    }
    return { state: seedData(), corrupt: false };
  } catch {
    return { state: seedData(), corrupt: true };
  }
}

/** 一次性灌入项目内置草稿正文；目标稿存在且正文拉取成功后记入 appliedOverlayIds，之后不再拉取 */
export async function applyProjectDraftOverlays(
  state: AppState,
  fetchText: (url: string) => Promise<string | null>
): Promise<AppState> {
  const appliedIds = new Set(state.appliedOverlayIds ?? []);
  let contentItems = state.contentItems;
  let changed = false;
  for (const overlay of PROJECT_DRAFT_OVERLAYS) {
    if (appliedIds.has(overlay.id)) continue;
    const hasTarget = contentItems.some(
      (item) => item.platform === overlay.platform && String(item.title || "").includes(overlay.titleIncludes)
    );
    if (!hasTarget) continue;
    let overlayBody: string | null = null;
    try {
      overlayBody = (await fetchText(overlay.bodyUrl))?.trim() || null;
    } catch {
      // 离线或文件缺失时跳过，下次启动再试
    }
    if (!overlayBody) continue;
    const result = applyDraftOverlayToItems(contentItems, overlay, overlayBody);
    contentItems = result.items;
    appliedIds.add(overlay.id);
    changed = true;
  }
  return changed ? { ...state, contentItems, appliedOverlayIds: [...appliedIds] } : state;
}
