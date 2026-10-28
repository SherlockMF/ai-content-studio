export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function send<T>(url: string, init: RequestInit, fallbackMessage: string): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as { message?: unknown };
  if (!response.ok) {
    const message = typeof payload.message === "string" && payload.message ? payload.message : fallbackMessage;
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

export function getJson<T>(url: string, fallbackMessage: string): Promise<T> {
  return send<T>(url, { method: "GET" }, fallbackMessage);
}

export function postJson<T>(
  url: string,
  body: unknown,
  fallbackMessage: string,
  init?: { signal?: AbortSignal }
): Promise<T> {
  return send<T>(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: init?.signal,
    },
    fallbackMessage
  );
}

export function postForm<T>(url: string, form: FormData, fallbackMessage: string): Promise<T> {
  return send<T>(url, { method: "POST", body: form }, fallbackMessage);
}
