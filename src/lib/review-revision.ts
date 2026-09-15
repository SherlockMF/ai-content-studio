import { z } from "zod";
import type { ContentReview } from "@/types/domain";
import { countXiaohongshuChars } from "@/lib/xiaohongshu/limits";

const imageSchema = z.object({
  index: z.number().int().positive(), role: z.enum(["cover", "content", "ending"]),
  objective: z.string(), overlayText: z.string(), composition: z.string(), prompt: z.string(),
  imageUrl: z.string().optional(), imageError: z.string().optional(),
});
export const reviewRevisionDraftSchema = z.object({
  platform: z.enum(["wechat", "xiaohongshu"]),
  title: z.string().max(2000), body: z.string().max(200000),
  digest: z.string().optional(), coverCopy: z.string().optional(), cta: z.string().optional(),
  visualDirection: z.string().optional(), imagePlan: z.array(imageSchema).max(8).optional(),
});
export type ReviewRevisionDraft = z.infer<typeof reviewRevisionDraftSchema>;
export const reviewRevisionRequestSchema = z.object({
  draft: reviewRevisionDraftSchema,
  issues: z.array(z.object({
    dimension: z.string().max(500), severity: z.enum(["low", "medium", "high"]),
    suggestion: z.string().trim().min(1).max(10000),
  })).min(1).max(50),
  sourceBody: z.string().max(200000).optional(), supplementaryNotes: z.string().max(50000).optional(),
  targetAudience: z.string().optional(),
  llm: z.object({
    provider: z.literal("deepseek").optional(), model: z.enum(["deepseek-v4-flash", "deepseek-v4-pro"]).optional(),
    apiKey: z.string().optional(), baseUrl: z.string().optional(),
  }).nullable().optional(),
});
export type ReviewRevisionRequest = z.infer<typeof reviewRevisionRequestSchema>;
const imageFields = ["objective", "overlayText", "composition", "prompt"] as const;
const editSchema = z.object({
  issueIndex: z.number().int().nonnegative(),
  field: z.enum(["title", "body", "digest", "coverCopy", "cta", "visualDirection", ...imageFields]),
  imageIndex: z.number().int().positive().nullable().optional(),
  before: z.string().max(200000), after: z.string().max(200000),
}).strict();
export const reviewEditsSchema = z.object({
  edits: z.array(editSchema).max(100), notes: z.string().max(5000).optional(),
});
export type ReviewEdit = z.infer<typeof editSchema>;

export function selectedReviewIssues(issues: ContentReview["issues"], indexes: number[]) {
  return issues.filter((_, index) => indexes.includes(index));
}

export function reviewRevisionSignature(draft: ReviewRevisionDraft, sourceBody = "", notes = "") {
  return JSON.stringify({ draft, sourceBody, notes });
}

function replaceOnce(value: string, before: string, after: string) {
  if (!before) {
    if (value) throw new Error("不能用空文本定位非空字段");
    return after;
  }
  const index = value.indexOf(before);
  if (index < 0) throw new Error("修改片段无法定位，请重新质检后重试");
  if (value.indexOf(before, index + 1) >= 0) throw new Error("修改片段不唯一，请缩小修改范围后重试");
  return value.slice(0, index) + after + value.slice(index + before.length);
}

export function applyReviewEdits(input: ReviewRevisionDraft, edits: ReviewEdit[], issueCount: number) {
  const draft = structuredClone(input);
  const changedImages = new Set<number>();
  let appliedEdits = 0;
  for (const raw of edits) {
    const edit = editSchema.parse(raw);
    if (edit.issueIndex >= issueCount) throw new Error("修改引用了未勾选的质检条目");
    if (edit.before === edit.after) continue;
    if ((imageFields as readonly string[]).includes(edit.field)) {
      const image = draft.imagePlan?.find(item => item.index === edit.imageIndex);
      if (draft.platform !== "xiaohongshu" || !image) throw new Error("找不到需要修改的配图");
      const field = edit.field as typeof imageFields[number];
      image[field] = replaceOnce(image[field], edit.before, edit.after);
      changedImages.add(image.index);
    } else {
      if (edit.imageIndex != null) throw new Error("文案修改不能指定图片序号");
      const field = edit.field as "title" | "body" | "digest" | "coverCopy" | "cta" | "visualDirection";
      if (field === "visualDirection") throw new Error("全账号视觉风格固定，请修改具体配图方案");
      if (draft.platform === "xiaohongshu" && ["digest", "coverCopy", "cta"].includes(field)) {
        throw new Error("小红书请直接修改标题、正文或配图方案");
      }
      draft[field] = replaceOnce(draft[field] ?? "", edit.before, edit.after);
    }
    appliedEdits++;
  }
  if (!draft.title.trim() || !draft.body.trim()) throw new Error("修改后标题和正文不能为空");
  if (draft.platform === "xiaohongshu") {
    if (countXiaohongshuChars(draft.title) > 20) throw new Error("修改后小红书标题超过 20 字，请重新生成完整短标题");
    if (countXiaohongshuChars(draft.body) > 1000) throw new Error("修改后小红书正文超过 1000 字，未保存");
  }
  for (const image of draft.imagePlan ?? []) {
    if (changedImages.has(image.index)) {
      delete image.imageUrl;
      delete image.imageError;
    }
  }
  return { draft, appliedEdits, changedImages: changedImages.size };
}
