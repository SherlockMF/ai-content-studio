import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { message: "抖音生成已降级，首期请使用公众号图文 /api/ai/wechat" },
    { status: 410 }
  );
}
