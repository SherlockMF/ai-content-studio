import { z } from "zod";
import { planWechatMedia } from "@/lib/ai/tasks/media-plan";
import { defineHandler } from "@/lib/api/handler";

const requestSchema = z.object({
  title: z.string().min(1), body: z.string().min(1), previousBody: z.string().optional(),
  llm: z.object({ provider: z.literal("deepseek").optional(), model: z.enum(["deepseek-v4-flash", "deepseek-v4-pro"]).optional(), apiKey: z.string().optional(), baseUrl: z.string().optional() }).optional(),
});

export const { POST } = defineHandler({
  schema: requestSchema,
  invalidMessage: "请提供标题和正文",
  failureMessage: "配图检查失败",
  run: planWechatMedia,
});
