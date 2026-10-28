import { z } from "zod";
import { resolveImageCredentials } from "@/lib/ai/credentials";
import { resolveImageSize } from "@/lib/ai/image-settings";
import { generateDashScopeImage } from "@/lib/ai/image/dashscope-image";
import { HandlerError, runHandler } from "@/lib/api/handler";
import { getAssetStore, type StoredAsset } from "@/lib/assets/store";
import { hasText } from "@/lib/has-text";

const requestSchema = z.object({
  prompt: z.string(),
  purpose: z.enum(["cover", "illustration", "xiaohongshu"]),
  size: z.string().optional(),
  model: z.enum(["wanx-v1", "qwen-image-3.0", "qwen-image-3.0-pro"]).optional(),
  image: z
    .object({
      provider: z.literal("dashscope").optional(),
      model: z.enum(["wanx-v1", "qwen-image-3.0", "qwen-image-3.0-pro"]).optional(),
      apiKey: z.string().optional(),
      baseUrl: z.string().optional(),
    })
    .nullable()
    .optional(),
});

function sniffMime(bytes: Uint8Array, fallbackUrl: string) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46
  ) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (/\.jpe?g(\?|$)/i.test(fallbackUrl)) return "image/jpeg";
  if (/\.webp(\?|$)/i.test(fallbackUrl)) return "image/webp";
  if (/\.gif(\?|$)/i.test(fallbackUrl)) return "image/gif";
  return "image/png";
}

export async function handleImageGenerateRequest(
  body: unknown,
  deps: {
    generate?: typeof generateDashScopeImage;
    fetchImpl?: typeof fetch;
    putAsset?: (input: {
      bytes: Uint8Array;
      mimeType: string;
      originalName?: string;
      kind?: "article-image" | "brand-icon";
    }) => Promise<StoredAsset>;
  } = {}
) {
  return runHandler(body, {
    schema: requestSchema,
    invalidMessage: "请求参数不完整",
    failureMessage: "生图失败",
    errorStatus: (message) => (/未配置 DashScope|不在允许列表/.test(message) ? 400 : undefined),
    run: async (input) => {
      if (!hasText(input.prompt)) throw new HandlerError("缺少生图提示词");
      const credentials = resolveImageCredentials(input.image);
      const model = input.model ?? credentials.model;
      const size = resolveImageSize(input.purpose, input.size);
      const generate = deps.generate ?? generateDashScopeImage;
      const { imageUrl } = await generate({
        apiKey: credentials.apiKey,
        baseUrl: credentials.baseUrl,
        model,
        prompt: input.prompt.trim(),
        size,
        fetchImpl: deps.fetchImpl,
      });

      const fetchImpl = deps.fetchImpl ?? fetch;
      const imageRes = await fetchImpl(imageUrl);
      if (!imageRes.ok) {
        throw new Error(`下载生成图片失败（HTTP ${imageRes.status}）`);
      }
      const bytes = new Uint8Array(await imageRes.arrayBuffer());
      if (bytes.byteLength > 8 * 1024 * 1024) {
        throw new Error("生成图片超过 8MB，无法保存");
      }
      const mimeType = sniffMime(bytes, imageUrl);
      const put = deps.putAsset ?? ((asset) => getAssetStore().put(asset));
      const stored = await put({
        bytes,
        mimeType,
        originalName: `${model}-${input.purpose}.png`,
        kind: "article-image",
      });

      return { url: stored.url, fileName: stored.fileName, contentHash: stored.contentHash };
    },
  });
}
