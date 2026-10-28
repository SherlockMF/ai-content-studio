import type { ZodType, ZodTypeDef } from "zod";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMProvider {
  generateStructuredOutput<T>(
    messages: LLMMessage[],
    schema: ZodType<T, ZodTypeDef, unknown>
  ): Promise<T>;
  /** 纯文本输出，用于长文改写等不适合 JSON 的场景 */
  generateText(messages: LLMMessage[]): Promise<string>;
}
