import { requestWechatMediaPlan } from "@/lib/api-client";
import { generateArticleImage } from "@/lib/ai/image/client";
import { renderWechatMedia } from "./wechat-media";

export async function generateWechatMedia(input: {
  title: string;
  body: string;
  previousBody?: string;
  onUpdate: (body: string) => void;
  onProgress?: (message: string) => void;
}) {
  input.onProgress?.("检查配图与正文是否匹配…");
  const plan = await requestWechatMediaPlan({ title: input.title, body: input.body, previousBody: input.previousBody });
  return renderWechatMedia(plan, {
    generate: generateArticleImage, onUpdate: input.onUpdate, onProgress: input.onProgress,
  });
}
