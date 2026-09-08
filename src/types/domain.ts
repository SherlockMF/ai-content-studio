export type Platform = "wechat" | "douyin" | "xiaohongshu";

export type ContentSection =
  | "AI 通识"
  | "工具与工作流"
  | "组织 AI 进化"
  | "行业观察";

export type ContentGoal =
  | "获取关注"
  | "建立专业信任"
  | "引发讨论"
  | "引导互动"
  | "转化关注";

export type MaterialType =
  | "观点"
  | "案例"
  | "素材片段"
  | "常用表达"
  | "禁止表达";

export type ContentStatus =
  | "AI 草稿"
  | "编辑中"
  | "待质检"
  | "待确认"
  | "待发布"
  | "公众号已发布"
  | "小红书已发布"
  | "已归档";

/** 已有草稿（含种子稿） vs 选题页 AI 新生成 */
export type ContentSource = "imported" | "ai";

/** 公众号出稿模式 */
export type WechatGenerateMode = "from_scratch" | "polish" | "preserve_structure";

export interface Workspace {
  id: string;
  name: string;
}

/** 轻量发布人设（设置页维护） */
export interface PublishVoice {
  id: string;
  workspaceId: string;
  accountName: string;
  voice: string;
  audience: string;
  style: string;
  bannedExpressions: string;
  defaultSections: ContentSection[];
  conversionNote?: string;
}

/** 出稿前临时 harness（不单独持久为大页面） */
export interface GenerationHarness {
  section: ContentSection;
  audienceFocus: string;
  goal: ContentGoal;
  materialIds: string[];
  bannedExtra: string;
  count?: number;
}

export interface MaterialItem {
  id: string;
  workspaceId: string;
  title: string;
  body: string;
  type: MaterialType;
  tags: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type KnowledgeDocumentStatus = "processing" | "ready" | "failed";

export interface KnowledgeDocument {
  id: string;
  workspaceId: string;
  title: string;
  fileName: string;
  extension: string;
  mimeType: string;
  size: number;
  extractedText: string;
  tags: string[];
  enabled: boolean;
  status: KnowledgeDocumentStatus;
  error?: string;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  workspaceId: string;
  order: number;
  content: string;
  createdAt: string;
}

/** 生成前由用户确认的知识库引用，仅发送命中的片段，不发送整份文档。 */
export interface KnowledgeReference {
  chunkId: string;
  documentId: string;
  sourceTitle: string;
  content: string;
  score: number;
}

export interface TopicDirection {
  id: string;
  hotspotId: string;
  title: string;
  angle: string;
  whyNow: string;
  targetAudience: string;
  outline: string[];
  coreViewpoint: string;
  section: ContentSection;
  openingHook: string;
  leverageAngle?: string;
}

export interface Topic {
  id: string;
  workspaceId: string;
  title: string;
  coreViewpoint: string;
  targetAudience: string;
  painPoint: string;
  section: ContentSection;
  platform: Platform[];
  contentGoal: ContentGoal;
  recommendedFormat: string;
  openingHook: string;
  scheduled: boolean;
  createdAt: string;
  hotspotId?: string;
  directionId?: string;
  hotspotTitle?: string;
  outline?: string[];
}

/** 盲测封面可上传的原产品图标位 */
export type BrandIconSlot = "Parvis" | "Codex" | "Cola" | "WorkBuddy";

/** 事实 Diff 单条记录（持久化快照） */
export interface FactDiffSnapshotItem {
  kind: "number" | "percent" | "entity";
  severity: "critical" | "warning";
  status: "missing" | "added" | "changed";
  before?: string;
  after?: string;
  message: string;
}

/** 最近一次 AI 改稿的事实核对结果 */
export interface FactDiffSnapshot {
  blocking: boolean;
  summary: string;
  itemCount: number;
  items: FactDiffSnapshotItem[];
  acknowledgedAt?: string;
  createdAt: string;
}

export type XiaohongshuTone = "professional" | "social";

/** 小红书两步转换的内部大纲（不落库） */
export interface XiaohongshuOutline {
  subjects: string[];
  keyFacts: string[];
  roundConclusions: string[];
  overallJudgment: string;
  optionalDetails: string[];
}

export interface XiaohongshuVariant {
  title: string;
  body: string;
  cta: string;
  hashtags: string[];
}

export interface XiaohongshuImagePrompt {
  index: number;
  role: "cover" | "content" | "ending";
  objective: string;
  overlayText: string;
  composition: string;
  prompt: string;
  /** 已生成的配图 URL（本机 article-assets 或外链） */
  imageUrl?: string;
  /** 最近一次生图失败原因 */
  imageError?: string;
}

export interface XiaohongshuGenerationResult {
  variants: Record<XiaohongshuTone, XiaohongshuVariant>;
  visualDirection: string;
  imagePlan: XiaohongshuImagePrompt[];
}

export interface XiaohongshuDraftData extends XiaohongshuGenerationResult {
  sourceContentId: string;
  activeTone: XiaohongshuTone;
}

export interface ContentItem {
  id: string;
  workspaceId: string;
  topicId: string;
  platform: Platform;
  /** 默认 imported：用户撰写/导入；ai：热点选题流程生成 */
  source: ContentSource;
  title: string;
  body: string;
  digest?: string;
  coverCopy?: string;
  cta?: string;
  /** 用户导入/上传时的正文快照，用于「恢复原始草稿」 */
  importBaseline?: ImportBaseline;
  /** 改稿补充信息（模型实名、测试条件等），AI 润色/质检时注入 */
  supplementaryNotes?: string;
  /** 封面生图用的原品牌图标（Parvis/Codex/Cola/WorkBuddy） */
  brandIconRefs?: Partial<Record<BrandIconSlot, string>>;
  /** 出稿时自动生成的封面提示词，进入稿件页可直接查看 */
  coverPromptPack?: {
    summary?: string;
    variants: Array<{
      id: string;
      styleLabel: string;
      overlayText: string;
      gptPrompt: string;
      altText: string;
      notes?: string;
    }>;
  };
  /** 最近一次 AI 润色的事实 Diff；blocking 且未确认时不可标「待发布」 */
  lastFactDiff?: FactDiffSnapshot;
  xiaohongshu?: XiaohongshuDraftData;
  status: ContentStatus;
  publishedAt?: string | null;
  scheduledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 导入/上传时的原始稿快照 */
export interface ImportBaseline {
  title: string;
  body: string;
  digest?: string;
  coverCopy?: string;
  cta?: string;
  savedAt: string;
}

export interface ContentVersion {
  id: string;
  contentItemId: string;
  versionNumber: number;
  title: string;
  body: string;
  digest?: string;
  coverCopy?: string;
  cta?: string;
  supplementaryNotes?: string;
  changeSource: "ai_generate" | "ai_rewrite" | "user_edit" | "restore";
  /** AI 润色后的事实 Diff 摘要 */
  factDiffSummary?: string;
  xiaohongshu?: XiaohongshuDraftData;
  createdAt: string;
}

export interface ContentReview {
  id: string;
  contentItemId: string;
  score: number;
  issues: Array<{
    dimension: string;
    severity: "low" | "medium" | "high";
    suggestion: string;
  }>;
  createdAt: string;
}
