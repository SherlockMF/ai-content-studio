import type { HotspotSnapshot } from "@/lib/hotspots/types";
import { getJson, postForm, postJson } from "./http";

export async function uploadArticleImage(file: File | Blob, fileName?: string) {
  const form = new FormData();
  if (fileName) form.append("file", file, fileName);
  else form.append("file", file);
  const { url } = await postForm<{ url?: string }>(
    "/api/upload/article-image",
    form,
    fileName ? `图片上传失败：${fileName}` : "图片上传失败"
  );
  if (!url) throw new Error("图片上传失败");
  return url;
}

export async function extractDocumentText(file: File, mode: "supplementary" | "knowledge") {
  const form = new FormData();
  form.append("file", file);
  form.append("mode", mode);
  const { text } = await postForm<{ text?: string }>("/api/documents/extract", form, "文档解析失败");
  return text ?? "";
}

export interface LocalXiaohongshuImages {
  folder?: string;
  images?: Array<{ index: number; role: string; url: string; fileName: string }>;
  message?: string;
}

export function importLocalXiaohongshuImages(input: { title: string; body: string }) {
  return postJson<LocalXiaohongshuImages>("/api/xiaohongshu/import-local-images", input, "导入本地配图失败");
}

export function fetchCachedHotspots() {
  return getJson<{ snapshot: HotspotSnapshot | null }>("/api/hotspots", "热点读取失败");
}

export function refreshHotspotSnapshot() {
  return postJson<{ snapshot: HotspotSnapshot }>("/api/hotspots", { forceRefresh: true }, "热点抓取失败");
}
