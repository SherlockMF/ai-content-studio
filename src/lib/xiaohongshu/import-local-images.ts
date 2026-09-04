import { copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getAssetStore } from "@/lib/assets/store";
import {
  type ImportedLocalImage,
  type XiaohongshuLocalFolder,
  parseLocalImageFileName,
} from "@/lib/xiaohongshu/import-local-images-shared";

export async function listLocalXiaohongshuImages(
  folder: XiaohongshuLocalFolder
): Promise<Array<{ index: number; role: string; fileName: string; absolutePath: string }>> {
  const dir = path.join(process.cwd(), "output", folder);
  const names = await readdir(dir).catch(() => [] as string[]);
  return names
    .map((fileName) => {
      const parsed = parseLocalImageFileName(fileName);
      if (!parsed) return null;
      return {
        ...parsed,
        fileName,
        absolutePath: path.join(dir, fileName),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => a.index - b.index);
}

/** 把 output/ 下脚本生成的 PNG 写入 public/article-assets，返回可访问 URL */
export async function importLocalXiaohongshuImages(
  folder: XiaohongshuLocalFolder
): Promise<ImportedLocalImage[]> {
  const listed = await listLocalXiaohongshuImages(folder);
  if (listed.length === 0) {
    throw new Error(
      `未找到本地配图：output/${folder}/（请先用脚本生成，或点「生成配图」在线生图）`
    );
  }

  const store = getAssetStore();
  const imported: ImportedLocalImage[] = [];

  for (const item of listed) {
    const bytes = new Uint8Array(await readFile(item.absolutePath));
    const stored = await store.put({
      bytes,
      mimeType: "image/png",
      originalName: item.fileName,
      kind: "article-image",
    });
    imported.push({
      index: item.index,
      role: item.role,
      fileName: item.fileName,
      url: stored.url,
    });
  }

  return imported;
}

/** 开发辅助：同时复制一份到 public/xiaohongshu-local/<folder> 方便核对 */
export async function mirrorLocalFolderToPublic(folder: XiaohongshuLocalFolder) {
  const destDir = path.join(process.cwd(), "public", "xiaohongshu-local", folder);
  await mkdir(destDir, { recursive: true });
  const listed = await listLocalXiaohongshuImages(folder);
  for (const item of listed) {
    await copyFile(item.absolutePath, path.join(destDir, item.fileName));
  }
  return listed.map((item) => ({
    index: item.index,
    role: item.role,
    url: `/xiaohongshu-local/${folder}/${item.fileName}`,
  }));
}
