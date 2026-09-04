import { withImagePayload } from "@/lib/ai/image-settings";

export async function generateArticleImage(input: {
  prompt: string;
  purpose: "cover" | "illustration" | "xiaohongshu";
  size?: string;
  model?: string;
}) {
  const response = await fetch("/api/ai/image/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      withImagePayload({
        prompt: input.prompt,
        purpose: input.purpose,
        ...(input.size ? { size: input.size } : {}),
        ...(input.model ? { model: input.model } : {}),
      })
    ),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    url?: string;
    fileName?: string;
    message?: string;
  };
  if (!response.ok || !payload.url) {
    throw new Error(
      typeof payload.message === "string" ? payload.message : "生图失败"
    );
  }
  return { url: payload.url, fileName: payload.fileName };
}
