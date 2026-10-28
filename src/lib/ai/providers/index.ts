import { resolveLLMCredentials } from "@/lib/ai/credentials";
import type { LLMClientSettings } from "@/lib/ai/llm-settings";
import { DeepSeekProvider } from "./deepseek-provider";
import { LLMProvider } from "./types";

export type { LLMClientSettings };

export function getLLMProvider(runtime?: Partial<LLMClientSettings> | null): LLMProvider {
  return new DeepSeekProvider(resolveLLMCredentials(runtime));
}
