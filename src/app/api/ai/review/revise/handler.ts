import { reviewRevisionRequestSchema } from "@/lib/review-revision";
import { reviseReviewedContent } from "@/lib/ai/review-revision";
import { runHandler } from "@/lib/api/handler";

export function handleReviewRevision(body: unknown, revise: typeof reviseReviewedContent = reviseReviewedContent) {
  return runHandler(body, {
    schema: reviewRevisionRequestSchema,
    invalidMessage: "请提供有效稿件并勾选至少一条质检问题",
    failureMessage: "质检修改失败，原稿未改动",
    run: revise,
  });
}
