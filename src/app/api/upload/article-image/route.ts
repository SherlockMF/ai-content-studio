import { NextResponse } from "next/server";
import { getAssetStore } from "@/lib/assets/store";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "请上传图片文件" }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ message: "仅支持 JPG / PNG / WebP / GIF" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ message: "图片不能超过 8MB" }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const stored = await getAssetStore().put({
      bytes,
      mimeType: file.type,
      originalName: file.name,
      kind: "article-image",
    });

    return NextResponse.json({
      url: stored.url,
      fileName: stored.fileName,
      contentHash: stored.contentHash,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "图片上传失败" },
      { status: 500 }
    );
  }
}
