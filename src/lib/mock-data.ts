import {
  ContentItem,
  ContentReview,
  ContentVersion,
  MaterialItem,
  PublishVoice,
  Topic,
  Workspace,
} from "@/types/domain";
import { DEFAULT_PUBLISH_VOICE, DEFAULT_WORKSPACE } from "@/lib/defaults";
import { nextWeekdays } from "@/lib/schedule";
import { ARTICLE_GIS, ARTICLE_HARNESS } from "@/lib/seed/articles";
import { ORG_ARCHITECTURE_SERIES } from "@/lib/seed/org-architecture-series";
import { PARVIS_BLINDTEST_SUPPLEMENTARY_NOTES } from "@/lib/content-supplementary-notes";

const now = new Date().toISOString();

function noonIso(date: Date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

/** 已归档两篇：放在组织系列之前，避免占 9/7 起的档期 */
const SCHEDULE_GIS = noonIso(new Date(2026, 7, 28)); // 2026-08-28
const SCHEDULE_HARNESS = noonIso(new Date(2026, 8, 4)); // 2026-09-04

/** 组织系列：从 2026-09-07 起按 01→06 顺序，连续工作日每天一篇 */
const ORG_SERIES_START = new Date(2026, 8, 7);
const ORG_SERIES_WEEKDAYS = nextWeekdays(ORG_SERIES_START, ORG_ARCHITECTURE_SERIES.length).map(
  noonIso
);

export const DEMO_WORKSPACE: Workspace = DEFAULT_WORKSPACE;

export const DEMO_PUBLISH_VOICE: PublishVoice = DEFAULT_PUBLISH_VOICE;

export const DEMO_MATERIALS: MaterialItem[] = [
  {
    id: "material_1",
    workspaceId: DEMO_WORKSPACE.id,
    title: "Tool Capability ≠ Agent Orchestration",
    body: "会做单项工具，不等于开放任务时知道何时该调用、先做什么后做什么。",
    type: "观点",
    tags: ["Agent", "行业观察"],
    enabled: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "material_2",
    workspaceId: DEMO_WORKSPACE.id,
    title: "Agent = Model + Harness",
    body: "Model 决定能力上限，Harness 决定能力兑现率。Agent 能不能稳定交付，关键看模型外面那套工作系统。",
    type: "观点",
    tags: ["Harness", "工具与工作流"],
    enabled: true,
    createdAt: now,
    updatedAt: now,
  },
];

export const DEMO_TOPICS: Topic[] = [
  {
    id: "topic_gis",
    workspaceId: DEMO_WORKSPACE.id,
    title: ARTICLE_GIS.title,
    coreViewpoint: ARTICLE_GIS.coreViewpoint,
    targetAudience: DEMO_PUBLISH_VOICE.audience,
    painPoint: ARTICLE_GIS.painPoint,
    section: ARTICLE_GIS.section,
    platform: ["wechat"],
    contentGoal: "建立专业信任",
    recommendedFormat: "公众号图文",
    openingHook: ARTICLE_GIS.openingHook,
    scheduled: true,
    createdAt: now,
  },
  {
    id: "topic_harness",
    workspaceId: DEMO_WORKSPACE.id,
    title: ARTICLE_HARNESS.title,
    coreViewpoint: ARTICLE_HARNESS.coreViewpoint,
    targetAudience: DEMO_PUBLISH_VOICE.audience,
    painPoint: ARTICLE_HARNESS.painPoint,
    section: ARTICLE_HARNESS.section,
    platform: ["wechat"],
    contentGoal: "建立专业信任",
    recommendedFormat: "公众号图文",
    openingHook: ARTICLE_HARNESS.openingHook,
    scheduled: true,
    createdAt: now,
  },
  ...ORG_ARCHITECTURE_SERIES.map((article) => ({
    id: `topic_org_${article.id}`,
    workspaceId: DEMO_WORKSPACE.id,
    title: article.title,
    coreViewpoint: article.coreViewpoint,
    targetAudience: DEMO_PUBLISH_VOICE.audience,
    painPoint: article.painPoint,
    section: article.section,
    platform: ["wechat"] as Topic["platform"],
    contentGoal: "建立专业信任" as const,
    recommendedFormat: "公众号图文",
    openingHook: article.openingHook,
    scheduled: true,
    createdAt: now,
  })),
];

export const DEMO_CONTENT_ITEMS: ContentItem[] = [
  {
    id: "content_gis",
    workspaceId: DEMO_WORKSPACE.id,
    topicId: "topic_gis",
    platform: "wechat",
    source: "imported",
    title: ARTICLE_GIS.title,
    digest: ARTICLE_GIS.digest,
    coverCopy: ARTICLE_GIS.coverCopy,
    body: ARTICLE_GIS.body,
    cta: "如果你也在对比城市规划 Agent，欢迎关注，下期继续写 Harness Engineering。",
    supplementaryNotes: PARVIS_BLINDTEST_SUPPLEMENTARY_NOTES,
    status: "已归档",
    scheduledAt: SCHEDULE_GIS,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "content_harness",
    workspaceId: DEMO_WORKSPACE.id,
    topicId: "topic_harness",
    platform: "wechat",
    source: "imported",
    title: ARTICLE_HARNESS.title,
    digest: ARTICLE_HARNESS.digest,
    coverCopy: ARTICLE_HARNESS.coverCopy,
    body: ARTICLE_HARNESS.body,
    cta: "下期继续拆专业 Agent 的工程问题。欢迎关注。",
    status: "已归档",
    scheduledAt: SCHEDULE_HARNESS,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  },
  ...ORG_ARCHITECTURE_SERIES.map((article, index) => {
    const baseline = {
      title: article.title,
      body: article.body,
      digest: article.digest,
      coverCopy: article.coverCopy,
      savedAt: now,
    };
    return {
      id: `content_org_${article.id}`,
      workspaceId: DEMO_WORKSPACE.id,
      topicId: `topic_org_${article.id}`,
      platform: "wechat" as const,
      source: "imported" as const,
      title: article.title,
      digest: article.digest,
      coverCopy: article.coverCopy,
      body: article.body,
      cta:
        index < ORG_ARCHITECTURE_SERIES.length - 1
          ? `下期继续写「AI 正在重新设计公司 · ${String(index + 2).padStart(2, "0")}/06」。欢迎关注。`
          : "本系列到此告一段落。欢迎关注，后续继续拆 AI 时代的组织变化。",
      supplementaryNotes: article.supplementaryNotes,
      importBaseline: baseline,
      status: "编辑中" as const,
      scheduledAt: ORG_SERIES_WEEKDAYS[index] ?? null,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }),
];

export const DEMO_VERSIONS: ContentVersion[] = DEMO_CONTENT_ITEMS.map((item, i) => ({
  id: `version_seed_${i + 1}`,
  contentItemId: item.id,
  versionNumber: 1,
  title: item.title,
  body: item.body,
  changeSource: "user_edit",
  createdAt: now,
}));

export const DEMO_REVIEWS: ContentReview[] = [];
