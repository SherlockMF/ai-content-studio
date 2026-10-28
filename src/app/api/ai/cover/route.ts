import { z } from "zod";
import { suggestCoverImages } from "@/lib/ai/generators";
import { defineHandler, HandlerError } from "@/lib/api/handler";
import { llmRequestSchema } from "@/lib/api/schemas";
import { isEvaluationDraft } from "@/lib/draft-profile";

const optionalText = z.unknown().transform((value) => (value ? String(value) : undefined));

const schema = z.object({
  title: z.unknown().transform((value) => String(value ?? "")),
  digest: optionalText,
  coverCopy: optionalText,
  body: optionalText,
  topicId: optionalText,
  isEvaluation: z.unknown().optional(),
  llm: llmRequestSchema,
});

export const { POST } = defineHandler({
  schema,
  invalidMessage: "请先填写标题或正文",
  failureMessage: "封面图分析失败",
  run: (input) => {
    if (!input.title.trim() && !input.body?.trim()) throw new HandlerError("请先填写标题或正文");
    const isEvaluation =
      typeof input.isEvaluation === "boolean"
        ? input.isEvaluation
        : isEvaluationDraft({ topicId: input.topicId ?? "", body: input.body ?? "" });
    return suggestCoverImages({
      title: input.title || "（无标题）",
      digest: input.digest,
      coverCopy: input.coverCopy,
      body: input.body,
      isEvaluation,
      llm: input.llm,
    });
  },
});
