import { LLMClientSettings, normalizeLLMSettings } from "@/lib/ai/llm-settings";
import { DeepSeekProvider } from "./deepseek-provider";
import { LLMProvider } from "./types";

export type { LLMClientSettings };

export function getLLMProvider(runtime?: Partial<LLMClientSettings> | null): LLMProvider {
  const settings = normalizeLLMSettings({
    model: (process.env.LLM_MODEL as LLMClientSettings["model"]) || undefined,
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY || "",
    baseUrl: process.env.DEEPSEEK_BASE_URL || undefined,
    ...runtime,
  });

  const apiKey = settings.apiKey || process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY || "";
  if (!apiKey.trim()) {
    throw new Error("未配置 DeepSeek API Key。请到设置页填写，或配置环境变量 DEEPSEEK_API_KEY。");
  }

  return new DeepSeekProvider({
    apiKey,
    model: settings.model === "deepseek-v4-pro" ? "deepseek-v4-pro" : "deepseek-v4-flash",
    baseUrl: settings.baseUrl,
  });
}
