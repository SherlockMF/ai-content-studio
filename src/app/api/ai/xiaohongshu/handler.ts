import { z } from "zod";
import { generateXiaohongshuArticle } from "@/lib/ai/generators";
import { xiaohongshuOutputSchema } from "@/lib/ai/schemas";
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

export async function handleXiaohongshuRequest(
  body: unknown,
  generate: typeof generateXiaohongshuArticle = generateXiaohongshuArticle
): Promise<{ status: number; payload: unknown }> {
  const request = requestSchema.safeParse(body);
  if (!request.success) {
    return { status: 400, payload: { message: "请求参数不完整" } };
  }
  if (!hasText(request.data.sourceContent.body)) {
    return { status: 400, payload: { message: "请先填写公众号正文" } };
  }

  try {
    const result = await generate(request.data);
    return { status: 200, payload: xiaohongshuOutputSchema.parse(result) };
  } catch (error) {
    return {
      status: 500,
      payload: { message: error instanceof Error ? error.message : "生成失败" },
    };
  }
}
