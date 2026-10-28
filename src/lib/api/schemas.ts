import { z } from "zod";
import type { LLMClientSettings } from "@/lib/ai/llm-settings";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 领域对象只做形状检查，字段细节由下游生成逻辑容错处理 */
export function objectOf<T>() {
  return z.custom<T>(isRecord);
}

export function arrayOf<T>() {
  return z.custom<T[]>(Array.isArray);
}

/** 带非空 title 的领域对象，例如选题 */
export function titledObjectOf<T>() {
  return z.custom<T>((value) => isRecord(value) && typeof value.title === "string" && value.title.trim() !== "");
}

/** 客户端运行时模型设置；服务端 getLLMProvider 会再做归一化 */
export const llmRequestSchema = z
  .custom<Partial<LLMClientSettings> | null | undefined>((value) => value == null || isRecord(value))
  .optional();
