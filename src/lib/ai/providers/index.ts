import {
  DEFAULT_LLM_SETTINGS,
  LLMClientSettings,
  normalizeLLMSettings,
} from "@/lib/ai/llm-settings";
import { DeepSeekProvider } from "./deepseek-provider";
import { LLMProvider } from "./types";

export type { LLMClientSettings };

function normalizeBaseUrl(baseUrl: string | undefined | null) {
  const trimmed = (baseUrl ?? "").trim().replace(/\/+$/, "");
  return trimmed || DEFAULT_LLM_SETTINGS.baseUrl;
}

function readServerApiKey() {
  return (process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY || "").trim();
}

export function getLLMProvider(runtime?: Partial<LLMClientSettings> | null): LLMProvider {
  const serverApiKey = readServerApiKey();
  const hasServerApiKey = Boolean(serverApiKey);
  const hasRuntimeApiKey = Boolean(runtime?.apiKey?.trim());
  // 本地 .env.local / 环境变量优先；仅当服务端未配置时才用浏览器设置页的 Key
  const useRuntimeCredentials = !hasServerApiKey && hasRuntimeApiKey;

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

  const baseUrl = normalizeBaseUrl(settings.baseUrl);
  if (useRuntimeCredentials) {
    const allowedBaseUrls = new Set(
      [
        "https://api.deepseek.com",
        process.env.DEEPSEEK_BASE_URL,
        ...(process.env.LLM_ALLOWED_BASE_URLS?.split(",") ?? []),
      ]
        .filter((item): item is string => Boolean(item?.trim()))
        .map(normalizeBaseUrl)
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

  return new DeepSeekProvider({
    apiKey,
    model: settings.model === "deepseek-v4-pro" ? "deepseek-v4-pro" : "deepseek-v4-flash",
    baseUrl,
  });
}
