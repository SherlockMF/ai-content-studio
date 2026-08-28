import JSZip from "jszip";
import {
  IMAGE_MD_RE,
  PLACEHOLDER_RE,
  parseDataUrl,
  fetchLocalAsset,
} from "@/lib/export-assets";

export { IMAGE_MD_RE, PLACEHOLDER_RE, parseDataUrl, fetchLocalAsset };

export function buildArticleMarkdown(input: {
  title: string;
  digest?: string;
  body: string;
  includeTitle?: boolean;
}) {
  const parts: string[] = [];
  if (input.includeTitle !== false) {
    parts.push(`# ${input.title.trim()}`, "");
  }
  if (input.digest?.trim()) {
    parts.push(`> ${input.digest.trim()}`, "");
  }
  parts.push(input.body.trim());
  return parts.join("\n");
}

/** 导出 article.md + assets/ 目录（本地 /article-assets/ 与 data URL 图片） */
export async function buildMarkdownZipBundle(input: {
  title: string;
  digest?: string;
  body: string;
  zipBaseName?: string;
  includeTitle?: boolean;
}) {
  let markdown = buildArticleMarkdown(input);
  const zip = new JSZip();
  const assets = zip.folder("assets");
  if (!assets) throw new Error("无法创建 assets 目录");

  const entries = [...markdown.matchAll(IMAGE_MD_RE)];
  let index = 0;

  for (const match of entries) {
    const full = match[0];
    const alt = match[1];
    const rawUrl = match[2].trim();
    if (!rawUrl || PLACEHOLDER_RE.test(rawUrl)) continue;

    try {
      let fileName: string;
      let bytes: Uint8Array;

      if (rawUrl.startsWith("data:image")) {
        const parsed = parseDataUrl(rawUrl);
        if (!parsed) continue;
        index += 1;
        fileName = `embedded-${index}.${parsed.ext}`;
        bytes = parsed.bytes;
      } else if (rawUrl.startsWith("/article-assets/")) {
        const fetched = await fetchLocalAsset(rawUrl);
        fileName = fetched.fileName;
        bytes = fetched.bytes;
      } else {
        continue;
      }

      assets.file(fileName, bytes);
      const relative = `./assets/${fileName}`;
      markdown = markdown.replace(full, `![${alt}](${relative})`);
    } catch {
      // 单张失败不阻断整包导出
    }
  }

  zip.file("article.md", markdown);
  const blob = await zip.generateAsync({ type: "blob" });
  const base =
    input.zipBaseName?.trim() ||
    input.title.trim().slice(0, 40).replace(/[\\/:*?"<>|]/g, "_") ||
    "wechat-article";
  return { blob, fileName: `${base}.zip` };
}

export function countExportableImages(body: string) {
  let local = 0;
  let placeholder = 0;
  for (const match of body.matchAll(IMAGE_MD_RE)) {
    const url = match[2].trim();
    if (PLACEHOLDER_RE.test(url)) {
      placeholder += 1;
    } else if (url.startsWith("/article-assets/") || url.startsWith("data:image")) {
      local += 1;
    }
  }
  return { local, placeholder };
}
