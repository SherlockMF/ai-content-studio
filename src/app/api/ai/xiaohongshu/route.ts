import { readJsonBody, toResponse } from "@/lib/api/handler";
import { handleXiaohongshuRequest } from "./handler";

export async function POST(request: Request) {
  return toResponse(await handleXiaohongshuRequest(await readJsonBody(request)));
}
