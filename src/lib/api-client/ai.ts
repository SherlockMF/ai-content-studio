import { withLLMPayload } from "@/lib/ai/llm-settings";
import type { TopicDeduplication } from "@/lib/ai/published-topic-check";
import type { PublishedArticle } from "@/lib/ai/published-topic-check";
import type { FactDiffReport } from "@/lib/fact-diff";
import type { HotspotItem } from "@/lib/hotspots/types";
import type { CoverImageVariant } from "@/lib/illustrations/cover";
import type { IllustrationSuggestion } from "@/lib/illustrations/insert";
import type { WechatMediaPlan } from "@/lib/illustrations/wechat-media";
import type { ReviewRevisionDraft } from "@/lib/review-revision";
import type {
  ContentReview,
  KnowledgeReference,
  MaterialItem,
  PublishVoice,
  Topic,
  TopicDirection,
  WechatGenerateMode,
  XiaohongshuImagePrompt,
} from "@/types/domain";
import { postJson } from "./http";

export interface WechatArticleRequest {
  voice: PublishVoice;
  materials: MaterialItem[];
  knowledgeReferences: KnowledgeReference[];
  topic: Topic;
  mode?: WechatGenerateMode;
  existingBody?: string;
  existingMeta?: { title?: string; digest?: string; coverCopy?: string; cta?: string };
  supplementaryNotes?: string;
  hotspot?: { title: string; url: string; summary?: string };
  direction?: TopicDirection;
}

export interface WechatArticleResponse {
  title: string;
  digest: string;
  coverCopy: string;
  body: string;
  cta: string;
  notes?: string;
  factDiff?: FactDiffReport;
  coverSummary?: string;
  coverVariants?: CoverImageVariant[];
  illustrationSummary?: string;
  illustrationInserted?: number;
}

export function requestWechatArticle(input: WechatArticleRequest, fallbackMessage = "生成失败") {
  return postJson<WechatArticleResponse>("/api/ai/wechat", withLLMPayload({ ...input }), fallbackMessage);
}

export type ReviewResult = Pick<ContentReview, "score" | "issues">;

function normalizeReview(payload: Partial<ReviewResult>): ReviewResult {
  return {
    score: typeof payload.score === "number" ? payload.score : 0,
    issues: Array.isArray(payload.issues) ? payload.issues : [],
  };
}

export async function requestWechatReview(input: {
  title: string;
  body: string;
  targetAudience: string;
  supplementaryNotes?: string;
}) {
  return normalizeReview(await postJson<Partial<ReviewResult>>("/api/ai/review", withLLMPayload({ ...input }), "质检失败"));
}

export async function requestXiaohongshuReview(input: {
  sourceBody: string;
  title: string;
  body: string;
  cta: string;
  hashtags: string[];
  visualDirection: string;
  imagePlan: XiaohongshuImagePrompt[];
  targetAudience: string;
}) {
  return normalizeReview(
    await postJson<Partial<ReviewResult>>(
      "/api/ai/review",
      withLLMPayload({ platform: "xiaohongshu", ...input }),
      "质检失败"
    )
  );
}

export interface ReviewRevisionResponse {
  draft: unknown;
  appliedEdits: number;
  changedImages?: number;
  notes?: string;
}

export function requestReviewRevision(
  input: {
    draft: ReviewRevisionDraft;
    issues: ContentReview["issues"];
    sourceBody?: string;
    supplementaryNotes?: string;
    targetAudience: string;
  },
  signal?: AbortSignal
) {
  return postJson<ReviewRevisionResponse>(
    "/api/ai/review/revise",
    withLLMPayload({ ...input }),
    "质检修改失败，原稿未改动",
    { signal }
  );
}

export function requestXiaohongshuConversion(input: {
  sourceContent: {
    id: string;
    title: string;
    digest?: string;
    body: string;
    cta?: string;
    supplementaryNotes?: string;
  };
  voice: PublishVoice;
}) {
  return postJson<unknown>("/api/ai/xiaohongshu", withLLMPayload({ ...input }), "小红书转换失败");
}

export interface ResearchDirectionsResponse {
  leverageAngle?: string;
  directions?: Array<Omit<TopicDirection, "id" | "hotspotId" | "leverageAngle">>;
  deduplication?: TopicDeduplication;
}

export function requestResearchDirections(input: {
  voice: PublishVoice;
  materials: MaterialItem[];
  knowledgeReferences: KnowledgeReference[];
  hotspot: HotspotItem;
  publishedArticles: PublishedArticle[];
}) {
  return postJson<ResearchDirectionsResponse>(
    "/api/ai/research-directions",
    withLLMPayload({ ...input }),
    "方向生成失败"
  );
}

export function requestIllustrationSuggestions(input: {
  title: string;
  body: string;
  topicId: string;
  isEvaluation: boolean;
}) {
  return postJson<{ summary?: string; suggestions?: IllustrationSuggestion[] }>(
    "/api/ai/illustrations",
    withLLMPayload({ ...input }),
    "配图分析失败"
  );
}

export function requestCoverSuggestions(input: {
  title: string;
  digest: string;
  coverCopy: string;
  body: string;
  topicId: string;
  isEvaluation: boolean;
}) {
  return postJson<{ summary?: string; variants?: CoverImageVariant[] }>(
    "/api/ai/cover",
    withLLMPayload({ ...input }),
    "封面图分析失败"
  );
}

export function requestWechatMediaPlan(input: { title: string; body: string; previousBody?: string }) {
  return postJson<WechatMediaPlan>("/api/ai/wechat/media-plan", withLLMPayload({ ...input }), "配图检查失败");
}
