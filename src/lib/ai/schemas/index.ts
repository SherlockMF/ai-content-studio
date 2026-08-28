import { z } from "zod";

export const topicDirectionSchema = z.object({
  title: z.string(),
  angle: z.string(),
  whyNow: z.string(),
  targetAudience: z.string(),
  outline: z.array(z.string()),
  coreViewpoint: z.string(),
  section: z.string(),
  openingHook: z.string(),
});

export const researchDirectionsOutputSchema = z.object({
  leverageAngle: z.string(),
  directions: z.array(topicDirectionSchema).min(1).max(3),
});

export const topicSchema = z.object({
  title: z.string(),
  coreViewpoint: z.string(),
  targetAudience: z.string(),
  painPoint: z.string(),
  section: z.string(),
  platform: z.array(z.enum(["wechat", "douyin", "xiaohongshu"])),
  contentGoal: z.string(),
  recommendedFormat: z.string(),
  openingHook: z.string(),
});

export const topicsOutputSchema = z.object({
  topics: z.array(topicSchema),
});

export const wechatArticleSchema = z.object({
  title: z.string(),
  digest: z.string(),
  coverCopy: z.string(),
  body: z.string(),
  cta: z.string(),
});

export const contentOutputSchema = z.object({
  title: z.string(),
  body: z.string(),
  cta: z.string(),
});

export const reviewOutputSchema = z.object({
  score: z.number().min(0).max(100),
  issues: z.array(
    z.object({
      dimension: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      suggestion: z.string(),
    })
  ),
});

export const rewriteOutputSchema = z.object({
  body: z.string().min(1),
  notes: z.string().optional(),
});

export const illustrationSuggestionSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  placementLabel: z.string(),
  anchorSnippet: z.string(),
  reason: z.string(),
  imageKind: z.string(),
  gptPrompt: z.string(),
  altText: z.string().optional(),
});

export const illustrationSuggestionsOutputSchema = z.object({
  summary: z.string().optional(),
  suggestions: z.array(illustrationSuggestionSchema).min(1).max(6),
});

export const coverImageVariantSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  styleLabel: z.string(),
  overlayText: z.string(),
  gptPrompt: z.string(),
  altText: z.string().optional(),
  notes: z.string().optional(),
});

export const coverImageOutputSchema = z.object({
  summary: z.string().optional(),
  variants: z.array(coverImageVariantSchema).min(1).max(4),
});
