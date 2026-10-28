import JSZip from "jszip";
import { uploadArticleImage } from "@/lib/api-client/files";
import { IMAGE_MD_RE } from "@/lib/export-assets";
import { parseMarkdownDraft } from "@/lib/import-markdown";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;

export interface ImportedMarkdownProject {
  title: string;
  digest?: string;
  body: string;
  uploadedImages: number;
  skippedImages: number;
}

function normalizePath(path: string) {
  return path
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .split("/")
    .filter((part) => part && part !== ".")
    .join("/")
    .toLowerCase();
}

function pickMarkdownPath(paths: string[]) {
  const mdPaths = paths.filter((p) => /\.(md|markdown|txt)$/i.test(p));
  if (mdPaths.length === 0) return null;
  const preferred = mdPaths.find((p) =>
    /(^|\/)article\.md$/i.test(p.replace(/\\/g, "/"))
  );
  if (preferred) return preferred;
  const wechat = mdPaths.find((p) => /公众号/.test(p));
  if (wechat) return wechat;
  return mdPaths.sort((a, b) => b.length - a.length)[0] ?? null;
}

function buildAssetLookup(files: Map<string, File | Blob>) {
  const byNorm = new Map<string, File | Blob>();
  const byBase = new Map<string, string[]>();

  for (const [path, file] of files) {
    const norm = normalizePath(path);
    byNorm.set(norm, file);
    const base = norm.split("/").pop() ?? norm;
    const list = byBase.get(base) ?? [];
    list.push(norm);
    byBase.set(base, list);
  }

  return { byNorm, byBase };
}

function resolveAsset(
  url: string,
  lookup: ReturnType<typeof buildAssetLookup>
): { file: File | Blob; name: string } | null {
  const cleaned = url.trim().replace(/^<|>$/g, "");
  if (!cleaned || /^https?:\/\//i.test(cleaned) || cleaned.startsWith("data:")) {
    return null;
  }

  const norm = normalizePath(decodeURIComponent(cleaned));
  const direct = lookup.byNorm.get(norm);
  if (direct) {
    return { file: direct, name: norm.split("/").pop() ?? "image.png" };
  }

  const base = norm.split("/").pop();
  if (!base) return null;
  const candidates = lookup.byBase.get(base) ?? [];
  if (candidates.length === 1) {
    const file = lookup.byNorm.get(candidates[0]!);
    if (file) return { file, name: base };
  }

  const suffix = candidates.find((c) => c.endsWith(`/${base}`) || c === base);
  if (suffix) {
    const file = lookup.byNorm.get(suffix);
    if (file) return { file, name: base };
  }

  return null;
}

async function rewriteMarkdownImages(
  markdown: string,
  lookup: ReturnType<typeof buildAssetLookup>
) {
  let uploaded = 0;
  let skipped = 0;
  let result = markdown;
  const replacements = new Map<string, string>();

  const matches = [...markdown.matchAll(IMAGE_MD_RE)];
  for (const match of matches) {
    const full = match[0];
    if (replacements.has(full)) continue;
    const alt = match[1];
    const url = match[2];
    const asset = resolveAsset(url, lookup);
    if (!asset) {
      skipped += 1;
      continue;
    }
    const publicUrl = await uploadArticleImage(asset.file, asset.name);
    uploaded += 1;
    replacements.set(full, `![${alt}](${publicUrl})`);
  }

  for (const [from, to] of replacements) {
    result = result.split(from).join(to);
  }

  return { body: result, uploadedImages: uploaded, skippedImages: skipped };
}

async function filesFromZip(file: File) {
  const zip = await JSZip.loadAsync(file);
  const map = new Map<string, File | Blob>();

  await Promise.all(
    Object.entries(zip.files).map(async ([path, entry]) => {
      if (entry.dir) return;
      const norm = path.replace(/\\/g, "/");
      if (/\.(md|markdown|txt)$/i.test(norm)) {
        const text = await entry.async("string");
        map.set(norm, new Blob([text], { type: "text/markdown" }));
        return;
      }
      if (IMAGE_EXT.test(norm)) {
        const blob = await entry.async("blob");
        map.set(norm, blob);
      }
    })
  );

  return map;
}

function filesFromDirectory(fileList: FileList) {
  const map = new Map<string, File | Blob>();
  for (const file of fileList) {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const norm = rel.replace(/\\/g, "/");
    map.set(norm, file);
  }
  return map;
}

async function importFromFileMap(map: Map<string, File | Blob>): Promise<ImportedMarkdownProject> {
  const paths = [...map.keys()];
  const mdPath = pickMarkdownPath(paths);
  if (!mdPath) throw new Error("未找到 .md / .markdown 文件");

  const mdEntry = map.get(mdPath);
  if (!mdEntry) throw new Error("无法读取 Markdown 文件");

  const raw =
    mdEntry instanceof Blob && !(mdEntry instanceof File)
      ? await mdEntry.text()
      : await (mdEntry as File).text();

  const assetMap = new Map<string, File | Blob>();
  for (const [path, entry] of map) {
    if (path === mdPath) continue;
    if (IMAGE_EXT.test(path)) assetMap.set(path, entry);
  }

  const lookup = buildAssetLookup(assetMap);
  const { body: rewritten, uploadedImages, skippedImages } = await rewriteMarkdownImages(
    raw,
    lookup
  );

  const parsed = parseMarkdownDraft(rewritten);
  return {
    title: parsed.title,
    digest: parsed.digest,
    body: parsed.body,
    uploadedImages,
    skippedImages,
  };
}

/** 导入 Markdown ZIP（article.md + assets/ 图片） */
export async function importMarkdownZip(file: File) {
  const map = await filesFromZip(file);
  return importFromFileMap(map);
}

/** 导入 Markdown 文件夹（webkitdirectory） */
export async function importMarkdownFolder(fileList: FileList) {
  const map = filesFromDirectory(fileList);
  return importFromFileMap(map);
}

/** 将已解析的项目写入当前选题草稿（由 UI 调用 persistDraft） */
export function projectToDraftFields(project: ImportedMarkdownProject) {
  return {
    title: project.title,
    digest: project.digest ?? "",
    body: project.body,
  };
}
