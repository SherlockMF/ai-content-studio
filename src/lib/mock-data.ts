import {
  ContentItem,
  ContentReview,
  ContentSection,
  ContentVersion,
  MaterialItem,
  PublishVoice,
  Topic,
  Workspace,
} from "@/types/domain";
import { nextFridays } from "@/lib/schedule";
import { ARTICLE_GIS, ARTICLE_HARNESS } from "@/lib/seed/articles";
import { PARVIS_BLINDTEST_SUPPLEMENTARY_NOTES } from "@/lib/content-supplementary-notes";

const now = new Date().toISOString();

function noonIso(date: Date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

/** GIS 篇：今天发布；Harness 篇：下周五 */
function scheduleTodayAndNextFriday() {
  const today = noonIso(new Date());
  const fridays = nextFridays(new Date(), 2);
  // 若今天就是周五，nextFridays[0] 是今天，下一周五是 [1]
  // 若今天不是周五，[0] 是即将到来的周五；用户要求「下周五」，在今天已是周五时应取 [1]
  const nextFriday =
    new Date().getDay() === 5
      ? noonIso(fridays[1] ?? fridays[0])
      : noonIso(fridays[0]);
  return { today, nextFriday };
}

const { today: SCHEDULE_TODAY, nextFriday: SCHEDULE_NEXT_FRIDAY } =
  scheduleTodayAndNextFriday();

export const DEMO_WORKSPACE: Workspace = {
  id: "ws_demo",
  name: "AI 内容发布工作台",
};

export const DEFAULT_SECTIONS: ContentSection[] = [
  "AI 通识",
  "工具与工作流",
  "组织 AI 进化",
  "行业观察",
];

export const DEMO_PUBLISH_VOICE: PublishVoice = {
  id: "voice_1",
  workspaceId: DEMO_WORKSPACE.id,
  accountName: "AI 进化笔记",
  voice: "关注 AI 应用与工作方式变化的内容创作者",
  audience: "对 AI 感兴趣的职场人、创业者与团队管理者",
  style: "清晰、克制、有观点，少套话，多用具体场景",
  bannedExpressions: "未来已来、颠覆一切、闭眼入、无脑照做、赋能闭环",
  defaultSections: DEFAULT_SECTIONS,
  conversionNote: "引导关注公众号，偶尔引导私信交流实践经验",
};

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
    status: "待发布",
    scheduledAt: SCHEDULE_TODAY,
    publishedAt: null,
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
    status: "待发布",
    scheduledAt: SCHEDULE_NEXT_FRIDAY,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  },
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
