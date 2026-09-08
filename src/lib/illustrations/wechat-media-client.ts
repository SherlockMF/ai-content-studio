import { withLLMPayload } from "@/lib/ai/llm-settings";
import { generateArticleImage } from "@/lib/ai/image/client";
import { renderWechatMedia, type WechatMediaPlan } from "./wechat-media";

export async function generateWechatMedia(input: {
  title: string;
  body: string;
  previousBody?: string;
  onUpdate: (body: string) => void;
  onProgress?: (message: string) => void;
}) {
  input.onProgress?.("检查配图与正文是否匹配…");
  const response = await fetch("/api/ai/wechat/media-plan", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withLLMPayload({ title: input.title, body: input.body, previousBody: input.previousBody })),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || "配图检查失败");
  return renderWechatMedia(payload as WechatMediaPlan, {
    generate: generateArticleImage, onUpdate: input.onUpdate, onProgress: input.onProgress,
  });
}
