import {
  ImageGenModelId,
  normalizeImageBaseUrl,
  resolveWanxV1Size,
} from "@/lib/ai/image-settings";

export interface DashScopeImageGenerateInput {
  model: ImageGenModelId;
  prompt: string;
  size: string;
  negativePrompt?: string;
}

export function isWanxModel(model: ImageGenModelId) {
  return model === "wanx-v1";
}

export function truncateWanxPrompt(prompt: string, maxChars = 800) {
  const trimmed = prompt.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars);
}

export function buildDashScopeImageRequestBody(input: DashScopeImageGenerateInput) {
  return {
    model: input.model,
    input: {
      messages: [
        {
          role: "user",
          content: [{ text: input.prompt }],
        },
      ],
    },
    parameters: {
      size: input.size,
      n: 1,
      watermark: false,
      ...(input.negativePrompt
        ? { negative_prompt: input.negativePrompt }
        : {}),
    },
  };
}

export function buildWanxImageRequestBody(input: DashScopeImageGenerateInput) {
  return {
    model: input.model,
    input: {
      prompt: truncateWanxPrompt(input.prompt),
      ...(input.negativePrompt
        ? { negative_prompt: truncateWanxPrompt(input.negativePrompt, 500) }
        : {}),
    },
    parameters: {
      size: resolveWanxV1Size(input.size),
      n: 1,
    },
  };
}

export function extractDashScopeImageUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as {
    output?: {
      choices?: Array<{
        message?: {
          content?: Array<{ image?: string; text?: string }>;
        };
      }>;
    };
  };
  const content = root.output?.choices?.[0]?.message?.content;
  if (!Array.isArray(content)) return null;
  for (const item of content) {
    if (item?.image && typeof item.image === "string" && item.image.trim()) {
      return item.image.trim();
    }
  }
  return null;
}

export function extractWanxTaskId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const taskId = (payload as { output?: { task_id?: unknown } }).output?.task_id;
  return typeof taskId === "string" && taskId.trim() ? taskId.trim() : null;
}

export function extractWanxResultUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const output = (payload as {
    output?: {
      task_status?: string;
      results?: Array<{ url?: string; code?: string; message?: string }>;
    };
  }).output;
  if (!output) return null;
  if (output.task_status === "FAILED") {
    const failed = output.results?.find((item) => item.message || item.code);
    throw new Error(
      failed?.message ||
        extractDashScopeErrorMessage(payload) ||
        "wanx-v1 任务失败"
    );
  }
  if (output.task_status !== "SUCCEEDED") return null;
  const url = output.results?.find((item) => item.url)?.url;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

export function extractDashScopeErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const message = (payload as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

export function isAllowedImageBaseUrl(
  baseUrl: string,
  extraAllowed: string[] = []
) {
  const normalized = normalizeImageBaseUrl(baseUrl);
  const allowed = new Set(
    [
      "https://dashscope.aliyuncs.com",
      "https://dashscope-intl.aliyuncs.com",
      ...extraAllowed,
    ].map(normalizeImageBaseUrl)
  );
  return allowed.has(normalized);
}

export function buildDashScopeGenerateUrl(baseUrl: string) {
  return `${normalizeImageBaseUrl(baseUrl)}/api/v1/services/aigc/multimodal-generation/generation`;
}

export function buildWanxGenerateUrl(baseUrl: string) {
  return `${normalizeImageBaseUrl(baseUrl)}/api/v1/services/aigc/text2image/image-synthesis`;
}

export function buildWanxTaskUrl(baseUrl: string, taskId: string) {
  return `${normalizeImageBaseUrl(baseUrl)}/api/v1/tasks/${encodeURIComponent(taskId)}`;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateWanxImage(input: {
  apiKey: string;
  baseUrl: string;
  model: ImageGenModelId;
  prompt: string;
  size: string;
  negativePrompt?: string;
  fetchImpl?: typeof fetch;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}): Promise<{ imageUrl: string; raw: unknown }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const createRes = await fetchImpl(buildWanxGenerateUrl(input.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify(
      buildWanxImageRequestBody({
        model: input.model,
        prompt: input.prompt,
        size: input.size,
        negativePrompt: input.negativePrompt,
      })
    ),
  });
  const createPayload = await createRes.json().catch(() => ({}));
  if (!createRes.ok) {
    throw new Error(
      extractDashScopeErrorMessage(createPayload) ||
        `wanx-v1 创建任务失败（HTTP ${createRes.status}）`
    );
  }
  const taskId = extractWanxTaskId(createPayload);
  if (!taskId) {
    throw new Error(
      extractDashScopeErrorMessage(createPayload) || "wanx-v1 未返回 task_id"
    );
  }

  const pollIntervalMs = input.pollIntervalMs ?? 3000;
  const maxPollAttempts = input.maxPollAttempts ?? 90;
  let lastPayload: unknown = createPayload;

  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    if (attempt > 0) await sleep(pollIntervalMs);
    const pollRes = await fetchImpl(buildWanxTaskUrl(input.baseUrl, taskId), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
      },
    });
    lastPayload = await pollRes.json().catch(() => ({}));
    if (!pollRes.ok) {
      throw new Error(
        extractDashScopeErrorMessage(lastPayload) ||
          `wanx-v1 查询任务失败（HTTP ${pollRes.status}）`
      );
    }
    try {
      const imageUrl = extractWanxResultUrl(lastPayload);
      if (imageUrl) {
        return { imageUrl, raw: lastPayload };
      }
    } catch (error) {
      throw error;
    }
  }

  throw new Error(
    extractDashScopeErrorMessage(lastPayload) || "wanx-v1 生图超时，请稍后重试"
  );
}

export async function generateQwenMultimodalImage(input: {
  apiKey: string;
  baseUrl: string;
  model: ImageGenModelId;
  prompt: string;
  size: string;
  negativePrompt?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ imageUrl: string; raw: unknown }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(buildDashScopeGenerateUrl(input.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify(
      buildDashScopeImageRequestBody({
        model: input.model,
        prompt: input.prompt,
        size: input.size,
        negativePrompt: input.negativePrompt,
      })
    ),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      extractDashScopeErrorMessage(payload) ||
        `DashScope 生图失败（HTTP ${response.status}）`
    );
  }

  const imageUrl = extractDashScopeImageUrl(payload);
  if (!imageUrl) {
    throw new Error(
      extractDashScopeErrorMessage(payload) || "DashScope 未返回图片地址"
    );
  }

  return { imageUrl, raw: payload };
}

export async function generateDashScopeImage(input: {
  apiKey: string;
  baseUrl: string;
  model: ImageGenModelId;
  prompt: string;
  size: string;
  negativePrompt?: string;
  fetchImpl?: typeof fetch;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}): Promise<{ imageUrl: string; raw: unknown }> {
  if (isWanxModel(input.model)) {
    return generateWanxImage(input);
  }
  return generateQwenMultimodalImage(input);
}
