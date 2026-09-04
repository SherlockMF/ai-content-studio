import { z } from "zod";
import {
  ImageGenSettings,
  normalizeImageGenSettings,
  resolveImageSize,
} from "@/lib/ai/image-settings";
import {
  generateDashScopeImage,
  isAllowedImageBaseUrl,
} from "@/lib/ai/image/dashscope-image";
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

function readServerImageApiKey() {
  return (process.env.DASHSCOPE_API_KEY || process.env.IMAGE_API_KEY || "").trim();
}

function readServerImageModel() {
  const raw = (process.env.DASHSCOPE_IMAGE_MODEL || process.env.IMAGE_MODEL || "").trim();
  return raw === "wanx-v1" ||
    raw === "qwen-image-3.0" ||
    raw === "qwen-image-3.0-pro"
    ? raw
    : undefined;
}

function resolveImageCredentials(runtime?: Partial<ImageGenSettings> | null) {
  const serverApiKey = readServerImageApiKey();
  const hasServerApiKey = Boolean(serverApiKey);
  const hasRuntimeApiKey = Boolean(runtime?.apiKey?.trim());
  const useRuntimeCredentials = !hasServerApiKey && hasRuntimeApiKey;

  const settings = normalizeImageGenSettings({
    ...runtime,
    model: runtime?.model ?? readServerImageModel(),
    apiKey: useRuntimeCredentials ? runtime?.apiKey : serverApiKey,
    baseUrl: useRuntimeCredentials
      ? runtime?.baseUrl
      : process.env.DASHSCOPE_BASE_URL || runtime?.baseUrl,
  });

  const extraAllowed =
    process.env.IMAGE_ALLOWED_BASE_URLS?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? [];

  if (useRuntimeCredentials && !isAllowedImageBaseUrl(settings.baseUrl, extraAllowed)) {
    throw new Error("生图 Base URL 不在允许列表，请使用 DashScope 官方地址。");
  }

  const apiKey = (settings.apiKey || serverApiKey).trim();
  if (!apiKey) {
    throw new Error(
      "未配置 DashScope API Key。请在设置页「生图模型」填写，或在 .env.local 配置 DASHSCOPE_API_KEY。"
    );
  }

  return { ...settings, apiKey };
}

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
): Promise<{ status: number; payload: unknown }> {
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, payload: { message: "请求参数不完整" } };
  }
  if (!hasText(parsed.data.prompt)) {
    return { status: 400, payload: { message: "缺少生图提示词" } };
  }

  try {
    const credentials = resolveImageCredentials(parsed.data.image);
    const model = parsed.data.model ?? credentials.model;
    const size = resolveImageSize(parsed.data.purpose, parsed.data.size);
    const generate = deps.generate ?? generateDashScopeImage;
    const { imageUrl } = await generate({
      apiKey: credentials.apiKey,
      baseUrl: credentials.baseUrl,
      model,
      prompt: parsed.data.prompt.trim(),
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
    const put = deps.putAsset ?? ((input) => getAssetStore().put(input));
    const stored = await put({
      bytes,
      mimeType,
      originalName: `${model}-${parsed.data.purpose}.png`,
      kind: "article-image",
    });

    return {
      status: 200,
      payload: {
        url: stored.url,
        fileName: stored.fileName,
        contentHash: stored.contentHash,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "生图失败";
    const status = /未配置 DashScope|不在允许列表/.test(message) ? 400 : 500;
    return { status, payload: { message } };
  }
}
