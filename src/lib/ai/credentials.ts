import { type ImageGenSettings, normalizeImageGenSettings } from "@/lib/ai/image-settings";
import { isAllowedImageBaseUrl } from "@/lib/ai/image/dashscope-image";
import {
  DEFAULT_LLM_SETTINGS,
  type LLMClientSettings,
  normalizeLLMSettings,
} from "@/lib/ai/llm-settings";

/**
 * 凭据优先级：服务端环境变量（.env.local）优先；仅当服务端未配置 Key 时才使用浏览器设置页传来的 Key，
 * 且此时 Base URL 必须在允许列表内，避免把 Key 发往任意地址。
 */
function shouldUseRuntimeCredentials(serverApiKey: string, runtimeApiKey: string | undefined) {
  return !serverApiKey && Boolean(runtimeApiKey?.trim());
}

function readEnvList(value: string | undefined) {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}

function normalizeLLMBaseUrl(baseUrl: string | undefined | null) {
  const trimmed = (baseUrl ?? "").trim().replace(/\/+$/, "");
  return trimmed || DEFAULT_LLM_SETTINGS.baseUrl;
}

export function resolveLLMCredentials(runtime?: Partial<LLMClientSettings> | null) {
  const serverApiKey = (process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY || "").trim();
  const useRuntimeCredentials = shouldUseRuntimeCredentials(serverApiKey, runtime?.apiKey);

  const settings = normalizeLLMSettings({
    provider: runtime?.provider,
    model:
      runtime?.model ??
      ((process.env.LLM_MODEL as LLMClientSettings["model"]) || undefined),
    apiKey: useRuntimeCredentials ? runtime?.apiKey : serverApiKey,
    baseUrl: useRuntimeCredentials
      ? runtime?.baseUrl?.trim() || undefined
      : process.env.DEEPSEEK_BASE_URL || undefined,
  });

  const baseUrl = normalizeLLMBaseUrl(settings.baseUrl);
  if (useRuntimeCredentials) {
    const allowedBaseUrls = new Set(
      [
        "https://api.deepseek.com",
        process.env.DEEPSEEK_BASE_URL,
        ...readEnvList(process.env.LLM_ALLOWED_BASE_URLS),
      ]
        .filter((item): item is string => Boolean(item?.trim()))
        .map(normalizeLLMBaseUrl)
    );
    if (!allowedBaseUrls.has(baseUrl)) {
      throw new Error("LLM Base URL 不在允许列表，请使用已配置的可信地址。");
    }
  }

  const apiKey = (settings.apiKey || serverApiKey).trim();
  if (!apiKey) {
    throw new Error(
      "未配置 DeepSeek API Key。请在项目根目录 .env.local 填写 DEEPSEEK_API_KEY，或到设置页填写。"
    );
  }

  return {
    apiKey,
    model: settings.model === "deepseek-v4-pro" ? ("deepseek-v4-pro" as const) : ("deepseek-v4-flash" as const),
    baseUrl,
  };
}

function readServerImageModel() {
  const raw = (process.env.DASHSCOPE_IMAGE_MODEL || process.env.IMAGE_MODEL || "").trim();
  return raw === "wanx-v1" ||
    raw === "qwen-image-3.0" ||
    raw === "qwen-image-3.0-pro"
    ? raw
    : undefined;
}

export function resolveImageCredentials(runtime?: Partial<ImageGenSettings> | null) {
  const serverApiKey = (process.env.DASHSCOPE_API_KEY || process.env.IMAGE_API_KEY || "").trim();
  const useRuntimeCredentials = shouldUseRuntimeCredentials(serverApiKey, runtime?.apiKey);

  const settings = normalizeImageGenSettings({
    ...runtime,
    model: runtime?.model ?? readServerImageModel(),
    apiKey: useRuntimeCredentials ? runtime?.apiKey : serverApiKey,
    baseUrl: useRuntimeCredentials
      ? runtime?.baseUrl
      : process.env.DASHSCOPE_BASE_URL || runtime?.baseUrl,
  });

  if (
    useRuntimeCredentials &&
    !isAllowedImageBaseUrl(settings.baseUrl, readEnvList(process.env.IMAGE_ALLOWED_BASE_URLS))
  ) {
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
