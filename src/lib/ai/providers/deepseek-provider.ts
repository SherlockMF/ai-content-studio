import { ZodError, ZodSchema } from "zod";
import { LLMMessage, LLMProvider } from "./types";

interface DeepSeekProviderOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

/**
 * OpenAI-compatible DeepSeek Chat Completions provider.
 * Model IDs: deepseek-v4-flash / deepseek-v4-pro
 */
export class DeepSeekProvider implements LLMProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(options: DeepSeekProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.baseUrl = (options.baseUrl || "https://api.deepseek.com").replace(/\/$/, "");
  }

  async generateText(messages: LLMMessage[]): Promise<string> {
    return this.chat(messages, false);
  }

  async generateStructuredOutput<T>(
    messages: LLMMessage[],
    schema: unknown
  ): Promise<T> {
    const zodSchema = schema as ZodSchema<T>;
    const withJsonHint: LLMMessage[] = [
      ...messages,
      {
        role: "user",
        content:
          "请严格输出一个 JSON 对象，不要 Markdown 代码块，不要额外说明文字。字段必须完整且类型正确。",
      },
    ];

    try {
      const text = await this.chat(withJsonHint, true);
      return zodSchema.parse(this.parseJson(text));
    } catch (error) {
      try {
        const retryText = await this.chat(
          [
            ...withJsonHint,
            {
              role: "user",
              content: "上一次输出格式不符合要求，请重新输出合法 JSON 对象。",
            },
          ],
          true
        );
        return zodSchema.parse(this.parseJson(retryText));
      } catch (retryError) {
        if (retryError instanceof ZodError || error instanceof ZodError) {
          throw new Error("模型返回格式异常，请稍后重试或缩小任务范围。");
        }
        throw retryError;
      }
    }
  }

  private parseJson(text: string) {
    const trimmed = text.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const payload = fenced?.[1]?.trim() ?? trimmed;
    try {
      return JSON.parse(payload);
    } catch {
      const bodyMatch = payload.match(/"body"\s*:\s*"((?:\\.|[^"\\])*)"/);
      if (bodyMatch) {
        return {
          body: JSON.parse(`"${bodyMatch[1]}"`),
        };
      }
      throw new Error("JSON parse failed");
    }
  }

  private async chat(messages: LLMMessage[], jsonMode: boolean) {
    if (!this.apiKey.trim()) {
      throw new Error("未填写 DeepSeek API Key，请先到设置页配置。");
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        thinking: { type: "disabled" },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `DeepSeek 调用失败（${response.status}）${detail ? `：${detail.slice(0, 200)}` : ""}`
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("DeepSeek 未返回有效内容。");
    }
    return content;
  }
}
