import { reviewRevisionRequestSchema } from "@/lib/review-revision";
import { reviseReviewedContent } from "@/lib/ai/review-revision";

export async function handleReviewRevision(body: unknown, revise: typeof reviseReviewedContent = reviseReviewedContent) {
  const parsed = reviewRevisionRequestSchema.safeParse(body);
  if (!parsed.success) return { status: 400, payload: { message: "请提供有效稿件并勾选至少一条质检问题" } };
  try {
    return { status: 200, payload: await revise(parsed.data) };
  } catch (error) {
    return { status: 500, payload: { message: error instanceof Error ? error.message : "质检修改失败，原稿未改动" } };
  }
}
