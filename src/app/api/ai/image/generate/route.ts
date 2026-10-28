import { readJsonBody, toResponse } from "@/lib/api/handler";
import { handleImageGenerateRequest } from "./handler";

export async function POST(request: Request) {
  return toResponse(await handleImageGenerateRequest(await readJsonBody(request)));
}
