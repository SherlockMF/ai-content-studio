import { withImagePayload } from "@/lib/ai/image-settings";
import { postJson } from "@/lib/api-client/http";

export async function generateArticleImage(input: {
  prompt: string;
  purpose: "cover" | "illustration" | "xiaohongshu";
  size?: string;
  model?: string;
}) {
  const payload = await postJson<{ url?: string; fileName?: string }>(
    "/api/ai/image/generate",
    withImagePayload({
      prompt: input.prompt,
      purpose: input.purpose,
      ...(input.size ? { size: input.size } : {}),
      ...(input.model ? { model: input.model } : {}),
    }),
    "生图失败"
  );
  if (!payload.url) throw new Error("生图失败");
  return { url: payload.url, fileName: payload.fileName };
}
