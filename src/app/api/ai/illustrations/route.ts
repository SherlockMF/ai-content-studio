import { z } from "zod";
import { suggestIllustrations } from "@/lib/ai/generators";
import { defineHandler, HandlerError } from "@/lib/api/handler";
import { llmRequestSchema } from "@/lib/api/schemas";
import { isEvaluationDraft } from "@/lib/draft-profile";

const schema = z.object({
  title: z.unknown().transform((value) => String(value ?? "")),
  body: z.unknown().transform((value) => String(value ?? "")),
  topicId: z.unknown().transform((value) => (value ? String(value) : undefined)),
  isEvaluation: z.unknown().optional(),
  llm: llmRequestSchema,
});

export const { POST } = defineHandler({
  schema,
  invalidMessage: "请先填写正文",
  failureMessage: "配图分析失败",
  run: (input) => {
    if (!input.body.trim()) throw new HandlerError("请先填写正文");
    const isEvaluation =
      typeof input.isEvaluation === "boolean"
        ? input.isEvaluation
        : isEvaluationDraft({ topicId: input.topicId ?? "", body: input.body });
    return suggestIllustrations({
      title: input.title || "（无标题）",
      body: input.body,
      isEvaluation,
      llm: input.llm,
    });
  },
});
