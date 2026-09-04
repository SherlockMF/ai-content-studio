export type LLMProviderId = "deepseek";

export type LLMModelId = "deepseek-v4-flash" | "deepseek-v4-pro";

export interface LLMClientSettings {
  provider: LLMProviderId;
  model: LLMModelId;
  apiKey: string;
  baseUrl: string;
}

export const LLM_SETTINGS_STORAGE_KEY = "ai-content-llm-settings-v2";

export const DEFAULT_LLM_SETTINGS: LLMClientSettings = {
  provider: "deepseek",
  model: "deepseek-v4-flash",
  apiKey: "",
  baseUrl: "https://api.deepseek.com",
};

export const LLM_MODEL_OPTIONS: Array<{
  value: LLMModelId;
  label: string;
  provider: LLMProviderId;
}> = [
  { value: "deepseek-v4-flash", label: "DeepSeek V4 Flash（推荐）", provider: "deepseek" },
  { value: "deepseek-v4-pro", label: "DeepSeek V4 Pro", provider: "deepseek" },
];

export function normalizeLLMSettings(input?: Partial<LLMClientSettings> | null): LLMClientSettings {
  const raw = input ?? {};
  const merged: LLMClientSettings = {
    ...DEFAULT_LLM_SETTINGS,
    ...Object.fromEntries(
      Object.entries(raw).filter(([, value]) => value !== undefined && value !== null)
    ),
  };
  // 清理历史 mock 配置
  const legacy = merged as { model?: string; provider?: string };
  if (legacy.model === "mock" || legacy.provider === "mock") {
    merged.model = "deepseek-v4-flash";
    merged.provider = "deepseek";
  }
  if (merged.model !== "deepseek-v4-flash" && merged.model !== "deepseek-v4-pro") {
    merged.model = "deepseek-v4-flash";
  }
  merged.provider = "deepseek";
  if (typeof merged.apiKey !== "string") {
    merged.apiKey = DEFAULT_LLM_SETTINGS.apiKey;
  }
  if (typeof merged.baseUrl !== "string" || !merged.baseUrl.trim()) {
    merged.baseUrl = DEFAULT_LLM_SETTINGS.baseUrl;
  }
  return merged;
}

export function loadLLMSettings(): LLMClientSettings {
  if (typeof window === "undefined") return DEFAULT_LLM_SETTINGS;
  try {
    const raw = window.localStorage.getItem(LLM_SETTINGS_STORAGE_KEY);
    if (!raw) {
      // 兼容旧 key
      const legacy = window.localStorage.getItem("ai-content-llm-settings-v1");
      if (!legacy) return DEFAULT_LLM_SETTINGS;
      return normalizeLLMSettings(JSON.parse(legacy) as Partial<LLMClientSettings>);
    }
    return normalizeLLMSettings(JSON.parse(raw) as Partial<LLMClientSettings>);
  } catch {
    return DEFAULT_LLM_SETTINGS;
  }
}

export function saveLLMSettings(settings: LLMClientSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    LLM_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizeLLMSettings(settings))
  );
}

/** 附加到 AI 请求体，供服务端选用真实模型 */
export function withLLMPayload<T extends Record<string, unknown>>(body: T) {
  return {
    ...body,
    llm: loadLLMSettings(),
  };
}
