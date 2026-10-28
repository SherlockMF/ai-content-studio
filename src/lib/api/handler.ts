import { NextResponse } from "next/server";
import type { z } from "zod";

export type HandlerResult<R = unknown> = { status: number; payload: R | { message: string } };

/** 在 run 中抛出，按指定状态码把 message 返回给客户端（默认 400） */
export class HandlerError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export interface HandlerConfig<S extends z.ZodTypeAny, R> {
  schema: S;
  /** 请求体未通过 schema 校验时的 400 提示 */
  invalidMessage: string;
  /** 非 Error 异常时的兜底提示 */
  failureMessage: string;
  run: (input: z.infer<S>) => Promise<R> | R;
  /** 把已知的配置类错误映射为非 500 状态码 */
  errorStatus?: (message: string) => number | undefined;
}

export async function runHandler<S extends z.ZodTypeAny, R>(
  body: unknown,
  config: HandlerConfig<S, R>
): Promise<HandlerResult<R>> {
  const parsed = config.schema.safeParse(body);
  if (!parsed.success) return { status: 400, payload: { message: config.invalidMessage } };
  try {
    return { status: 200, payload: await config.run(parsed.data) };
  } catch (error) {
    if (error instanceof HandlerError) return { status: error.status, payload: { message: error.message } };
    const message = error instanceof Error ? error.message : config.failureMessage;
    return { status: config.errorStatus?.(message) ?? 500, payload: { message } };
  }
}

export async function readJsonBody(request: Request): Promise<unknown> {
  return request.json().catch(() => ({}));
}

export function toResponse(result: HandlerResult) {
  return NextResponse.json(result.payload, { status: result.status });
}

/** 统一请求解析、Zod 校验与错误映射；返回可测试的 handle 与路由用的 POST */
export function defineHandler<S extends z.ZodTypeAny, R>(config: HandlerConfig<S, R>) {
  const handle = (body: unknown) => runHandler(body, config);
  async function POST(request: Request) {
    return toResponse(await handle(await readJsonBody(request)));
  }
  return { handle, POST };
}
