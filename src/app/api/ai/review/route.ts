import { z } from "zod";
import { reviewContent, reviewXiaohongshuContent } from "@/lib/ai/reviewers";
import { defineHandler } from "@/lib/api/handler";
import { llmRequestSchema } from "@/lib/api/schemas";
import type { XiaohongshuImagePrompt } from "@/types/domain";

const text = z.unknown().transform((value) => (typeof value === "string" ? value : value == null ? "" : String(value)));
const list = <T>() => z.unknown().transform((value) => (Array.isArray(value) ? (value as T[]) : []));

const schema = z.object({
  platform: z.unknown().optional(),
  title: text,
  body: text,
  cta: text,
  sourceBody: text,
  visualDirection: text,
  targetAudience: text,
  hashtags: list<string>(),
  imagePlan: list<XiaohongshuImagePrompt>(),
  supplementaryNotes: z.string().nullish(),
  llm: llmRequestSchema,
});

export const { POST } = defineHandler({
  schema,
  invalidMessage: "质检请求参数不完整",
  failureMessage: "质检失败",
  run: (input) =>
    input.platform === "xiaohongshu"
      ? reviewXiaohongshuContent({
          sourceBody: input.sourceBody,
          title: input.title,
          body: input.body,
          cta: input.cta,
          hashtags: input.hashtags,
          visualDirection: input.visualDirection,
          imagePlan: input.imagePlan,
          targetAudience: input.targetAudience,
          llm: input.llm,
        })
      : reviewContent({
          title: input.title,
          body: input.body,
          targetAudience: input.targetAudience,
          supplementaryNotes: input.supplementaryNotes ?? undefined,
          llm: input.llm,
        }),
});
