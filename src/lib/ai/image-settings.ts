export type ImageGenProviderId = "dashscope";

export type ImageGenModelId = "wanx-v1" | "qwen-image-3.0" | "qwen-image-3.0-pro";

export type ImageGenPurpose = "cover" | "illustration" | "xiaohongshu";

export interface ImageGenSettings {
  provider: ImageGenProviderId;
  model: ImageGenModelId;
  apiKey: string;
  baseUrl: string;
}

export const IMAGE_SETTINGS_STORAGE_KEY = "ai-content-image-settings-v1";

export const DEFAULT_IMAGE_GEN_SETTINGS: ImageGenSettings = {
  provider: "dashscope",
  model: "qwen-image-3.0",
  apiKey: "",
  baseUrl: "https://dashscope.aliyuncs.com",
};

export const IMAGE_GEN_MODEL_OPTIONS: Array<{
  value: ImageGenModelId;
  label: string;
}> = [
  { value: "qwen-image-3.0", label: "Qwen-Image 3.0（推荐，文字排版更稳）" },
  { value: "qwen-image-3.0-pro", label: "Qwen-Image 3.0 Pro" },
  { value: "wanx-v1", label: "wanx-v1（免费额度文生图）" },
];

export const IMAGE_SIZE_BY_PURPOSE: Record<ImageGenPurpose, string> = {
  cover: "1472*624",
  illustration: "1280*720",
  /** 竖版接近 3:4；wanx/qwen 均可接受的竖版尺寸 */
  xiaohongshu: "960*1280",
};

/** wanx-v1 官方支持的尺寸枚举 */
export const WANX_V1_SUPPORTED_SIZES = [
  "1024*1024",
  "720*1280",
  "768*1152",
  "1280*720",
] as const;

export function normalizeImageBaseUrl(baseUrl: string | undefined | null) {
  const trimmed = (baseUrl ?? "").trim().replace(/\/+$/, "");
  return trimmed || DEFAULT_IMAGE_GEN_SETTINGS.baseUrl;
}

export function isImageGenModelId(value: unknown): value is ImageGenModelId {
  return (
    value === "wanx-v1" ||
    value === "qwen-image-3.0" ||
    value === "qwen-image-3.0-pro"
  );
}

export function normalizeImageGenSettings(
  input?: Partial<ImageGenSettings> | null
): ImageGenSettings {
  const raw = input ?? {};
  const model = isImageGenModelId(raw.model)
    ? raw.model
    : DEFAULT_IMAGE_GEN_SETTINGS.model;
  return {
    provider: "dashscope",
    model,
    apiKey: typeof raw.apiKey === "string" ? raw.apiKey.trim() : "",
    baseUrl: normalizeImageBaseUrl(raw.baseUrl),
  };
}

export function loadImageGenSettings(): ImageGenSettings {
  if (typeof window === "undefined") return DEFAULT_IMAGE_GEN_SETTINGS;
  try {
    const raw = window.localStorage.getItem(IMAGE_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_IMAGE_GEN_SETTINGS;
    return normalizeImageGenSettings(JSON.parse(raw) as Partial<ImageGenSettings>);
  } catch {
    return DEFAULT_IMAGE_GEN_SETTINGS;
  }
}

export function saveImageGenSettings(settings: ImageGenSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    IMAGE_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizeImageGenSettings(settings))
  );
}

export function withImagePayload<T extends Record<string, unknown>>(body: T) {
  return {
    ...body,
    image: loadImageGenSettings(),
  };
}

export function resolveImageSize(purpose: ImageGenPurpose, size?: string) {
  const custom = size?.trim();
  if (custom && /^\d+\*\d+$/.test(custom)) return custom;
  return IMAGE_SIZE_BY_PURPOSE[purpose];
}

/** 将任意尺寸映射到 wanx-v1 支持的最接近竖/横枚举 */
export function resolveWanxV1Size(size: string): (typeof WANX_V1_SUPPORTED_SIZES)[number] {
  if ((WANX_V1_SUPPORTED_SIZES as readonly string[]).includes(size)) {
    return size as (typeof WANX_V1_SUPPORTED_SIZES)[number];
  }
  const match = /^(\d+)\*(\d+)$/.exec(size.trim());
  if (!match) return "1024*1024";
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (height > width) {
    const ratio = width / height;
    return Math.abs(ratio - 768 / 1152) <= Math.abs(ratio - 720 / 1280)
      ? "768*1152"
      : "720*1280";
  }
  if (width > height) return "1280*720";
  return "1024*1024";
}
