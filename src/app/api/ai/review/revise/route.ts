import { readJsonBody, toResponse } from "@/lib/api/handler";
import { handleReviewRevision } from "./handler";

export async function POST(request: Request) {
  return toResponse(await handleReviewRevision(await readJsonBody(request)));
}
