import { NextResponse } from "next/server";
import { strFromU8, unzipSync } from "fflate";
import {
  MAX_KNOWLEDGE_FILE_BYTES,
  truncateExtractedText,
} from "@/lib/extract-document-text";

function extractDocxText(buffer: Uint8Array): string {
  const files = unzipSync(buffer);
  const docXml = files["word/document.xml"];
  if (!docXml) {
    throw new Error("无效的 docx：缺少 word/document.xml");
  }
  const xml = strFromU8(docXml);
  const withBreaks = xml
    .replace(/<w:tab[^/]*\/>/g, "\t")
    .replace(/<w:br[^/]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n");
  const text = withBreaks
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

async function extractPdfText(buffer: Uint8Array) {
  const pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  const workerGlobal = globalThis as typeof globalThis & {
    pdfjsWorker?: typeof pdfjsWorker;
  };
  workerGlobal.pdfjsWorker = pdfjsWorker;
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .filter(Boolean)
        .join(" ")
    );
  }
  await loadingTask.destroy();
  return pages.filter(Boolean).join("\n\n");
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "请上传文件" }, { status: 400 });
    }
    if (file.size > MAX_KNOWLEDGE_FILE_BYTES) {
      return NextResponse.json({ message: "文件超过 10 MB" }, { status: 413 });
    }
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".docx") && !lowerName.endsWith(".pdf")) {
      return NextResponse.json({ message: "仅支持 .docx / .pdf" }, { status: 400 });
    }
    const mode = form.get("mode") === "knowledge" ? "knowledge" : "supplementary";
    const buffer = new Uint8Array(await file.arrayBuffer());
    const raw = lowerName.endsWith(".pdf")
      ? await extractPdfText(buffer)
      : extractDocxText(buffer);
    if (!raw.trim()) {
      return NextResponse.json({ message: "未能从文档中提取文字" }, { status: 422 });
    }
    return NextResponse.json({
      text: mode === "knowledge" ? raw.trim() : truncateExtractedText(raw),
      fileName: file.name,
      charCount: raw.length,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "文档解析失败" },
      { status: 500 }
    );
  }
}
