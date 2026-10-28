import { z } from "zod";
import {
  extractHashtagsFromText,
  foldXiaohongshuVariant,
} from "@/lib/xiaohongshu/note-body";

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

const xiaohongshuVariantSchema = z
  .object({
    title: z.string(),
    body: z.string(),
    cta: z.string().optional().default(""),
    hashtags: z.array(z.string()).optional().default([]),
  })
  .transform((value) =>
    foldXiaohongshuVariant({
      title: value.title,
      body: value.body,
      cta: value.cta ?? "",
      hashtags: value.hashtags ?? [],
    })
  )
  .superRefine((value, context) => {
    if (!value.title.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "标题不能为空",
        path: ["title"],
      });
    }
    if (!value.body.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "正文不能为空",
        path: ["body"],
      });
    }
    const tags = extractHashtagsFromText(value.body);
    if (tags.length < 5 || tags.length > 8) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "正文末尾需要 5～8 个 #话题",
        path: ["body"],
      });
    }
  });

export const xiaohongshuOutlineSchema = z.object({
  subjects: z.array(z.string().trim().min(1)).min(1),
  keyFacts: z.array(z.string().trim().min(1)).min(1),
  roundConclusions: z.array(z.string().trim().min(1)).min(1),
  overallJudgment: z.string().trim().min(1),
  optionalDetails: z
    .array(z.string().trim().min(1))
    .nullish()
    .transform((value) => value ?? []),
});

export const xiaohongshuOutputSchema = z.object({
  variants: z.object({
    professional: xiaohongshuVariantSchema,
    social: xiaohongshuVariantSchema,
  }),
  visualDirection: z.string().trim().min(1),
  imagePlan: z
    .array(
      z.object({
        index: z.number().int().positive(),
        role: z.enum(["cover", "content", "ending"]),
        objective: z.string().trim().min(1),
        overlayText: z.string().trim().min(1),
        composition: z.string().trim().min(1),
        prompt: z.string().trim().min(1),
        imageUrl: z.string().trim().min(1).optional(),
        imageError: z.string().trim().min(1).optional(),
      })
    )
    .min(5)
    .max(8)
    .superRefine((items, context) => {
      if (items[0]?.role !== "cover") {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "首张图片必须是 cover" });
      }
      if (items.at(-1)?.role !== "ending") {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "末张图片必须是 ending" });
      }
      if (items.some((item, index) => item.index !== index + 1)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "图片序号必须从 1 连续递增" });
      }
    }),
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
  /** 模型偶发多返回时仍解析成功，调用方只取第一套 */
  variants: z.array(coverImageVariantSchema).min(1).max(4),
});