import { z } from "zod";
import { refineCoverPrompt } from "@/lib/ai/generators";
import { coverPromptRefineOutputSchema } from "@/lib/ai/schemas";
import { hasText } from "@/lib/has-text";

const requestSchema = z.object({
  title: z.string().optional(),
  styleLabel: z.string().optional(),
  overlayText: z.string().optional(),
  gptPrompt: z.string(),
  suggestion: z.string(),
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

export async function handleCoverRefineRequest(
  body: unknown,
  refine: typeof refineCoverPrompt = refineCoverPrompt
): Promise<{ status: number; payload: unknown }> {
  const request = requestSchema.safeParse(body);
  if (!request.success) {
    return { status: 400, payload: { message: "请求参数不完整" } };
  }
  if (!hasText(request.data.gptPrompt)) {
    return { status: 400, payload: { message: "缺少原提示词" } };
  }
  if (!hasText(request.data.suggestion)) {
    return { status: 400, payload: { message: "请先填写修改建议" } };
  }

  try {
    const result = await refine(request.data);
    return { status: 200, payload: coverPromptRefineOutputSchema.parse(result) };
  } catch (error) {
    return {
      status: 500,
      payload: { message: error instanceof Error ? error.message : "优化失败" },
    };
  }
}
