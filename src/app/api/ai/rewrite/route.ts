import { z } from "zod";
import { deAiRewrite } from "@/lib/ai/generators";
import { DE_AI_SKILL_SOURCES } from "@/lib/ai/skills";
import { defineHandler, HandlerError } from "@/lib/api/handler";
import { llmRequestSchema } from "@/lib/api/schemas";

const schema = z.object({
  original: z.unknown().optional(),
  body: z.unknown().optional(),
  title: z.unknown().transform((value) => (value ? String(value) : undefined)),
  llm: llmRequestSchema,
});

export const { POST } = defineHandler({
  schema,
  invalidMessage: "缺少待改写正文",
  failureMessage: "去 AI 味改写失败",
  run: async (input) => {
    const original = String(input.original ?? input.body ?? "");
    if (!original.trim()) throw new HandlerError("缺少待改写正文");
    const result = await deAiRewrite({ original, title: input.title, llm: input.llm });
    return { ...result, skills: DE_AI_SKILL_SOURCES };
  },
});
