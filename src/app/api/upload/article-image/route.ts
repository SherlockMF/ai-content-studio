import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

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

    const ext =
      path.extname(file.name) ||
      (file.type === "image/jpeg" ? ".jpg" : file.type === "image/webp" ? ".webp" : ".png");
    const safeExt = ext.toLowerCase().replace(/[^a-z0-9.]/g, "") || ".png";
    const fileName = `img_${Date.now()}${safeExt}`;
    const dir = path.join(process.cwd(), "public", "article-assets");
    await mkdir(dir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, fileName), buffer);

    return NextResponse.json({
      url: `/article-assets/${fileName}`,
      fileName,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "图片上传失败" },
      { status: 500 }
    );
  }
}
