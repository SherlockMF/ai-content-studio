import { z } from "zod";
import { generateXiaohongshuArticle } from "@/lib/ai/generators";
import { xiaohongshuOutputSchema } from "@/lib/ai/schemas";
import { HandlerError, runHandler } from "@/lib/api/handler";
import { hasText } from "@/lib/has-text";

const requestSchema = z.object({
  sourceContent: z.object({
    id: z.string(),
    title: z.string(),
    digest: z.string().optional(),
    body: z.string(),
    cta: z.string().optional(),
    supplementaryNotes: z.string().optional(),
  }),
  voice: z.object({
    id: z.string(),
    workspaceId: z.string(),
    accountName: z.string(),
    voice: z.string(),
    audience: z.string(),
    style: z.string(),
    bannedExpressions: z.string(),
    defaultSections: z.array(
      z.enum(["AI 通识", "工具与工作流", "组织 AI 进化", "行业观察"])
    ),
    conversionNote: z.string().optional(),
  }),
  llm: z
    .object({
      provider: z.literal("deepseek").optional(),
      model: z.enum(["deepseek-v4-flash", "deepseek-v4-pro"]).optional(),
      apiKey: z.string().optional(),
      baseUrl: z.string().optional(),
    })
    .nullable()
    .optional(),
});

export function handleXiaohongshuRequest(
  body: unknown,
  generate: typeof generateXiaohongshuArticle = generateXiaohongshuArticle
) {
  return runHandler(body, {
    schema: requestSchema,
    invalidMessage: "请求参数不完整",
    failureMessage: "生成失败",
    run: async (input) => {
      if (!hasText(input.sourceContent.body)) throw new HandlerError("请先填写公众号正文");
      return xiaohongshuOutputSchema.parse(await generate(input));
    },
  });
}
