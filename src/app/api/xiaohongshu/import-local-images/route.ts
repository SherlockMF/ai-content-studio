import { NextResponse } from "next/server";
import { z } from "zod";
import { importLocalXiaohongshuImages } from "@/lib/xiaohongshu/import-local-images";
import {
  XIAOHONGSHU_LOCAL_FOLDERS,
  resolveLocalFolderHint,
} from "@/lib/xiaohongshu/import-local-images-shared";

const bodySchema = z.object({
  folder: z.enum(XIAOHONGSHU_LOCAL_FOLDERS).optional(),
  title: z.string().optional(),
  body: z.string().optional(),
});

export async function POST(request: Request) {
  const raw = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ message: "请求参数不完整" }, { status: 400 });
  }

  const folder =
    parsed.data.folder ??
    resolveLocalFolderHint({
      title: parsed.data.title,
      body: parsed.data.body,
    });

  try {
    const images = await importLocalXiaohongshuImages(folder);
    return NextResponse.json({ folder, images });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "导入失败" },
      { status: 400 }
    );
  }
}
