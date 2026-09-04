import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export type AssetKind = "article-image" | "brand-icon";

export interface StoredAsset {
  /** 对外可访问 URL，如 /article-assets/xxx.png */
  url: string;
  fileName: string;
  contentHash: string;
  bytes: number;
  mimeType: string;
}

export interface AssetStore {
  put(input: {
    bytes: Uint8Array;
    mimeType: string;
    originalName?: string;
    kind?: AssetKind;
  }): Promise<StoredAsset>;
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function extFromMime(mimeType: string, originalName?: string) {
  const fromName = originalName ? path.extname(originalName).toLowerCase() : "";
  if (fromName && /^\.[a-z0-9]+$/.test(fromName)) return fromName;
  return MIME_EXT[mimeType] ?? ".png";
}

/** 本机开发：写入 public/article-assets，文件名含内容 hash 防重复 */
export class LocalAssetStore implements AssetStore {
  constructor(private readonly rootDir = path.join(process.cwd(), "public", "article-assets")) {}

  async put(input: {
    bytes: Uint8Array;
    mimeType: string;
    originalName?: string;
    kind?: AssetKind;
  }): Promise<StoredAsset> {
    const hash = createHash("sha256").update(input.bytes).digest("hex").slice(0, 16);
    const ext = extFromMime(input.mimeType, input.originalName);
    const prefix = input.kind === "brand-icon" ? "brand" : "img";
    const fileName = `${prefix}_${hash}${ext}`;
    await mkdir(this.rootDir, { recursive: true });
    const fullPath = path.join(this.rootDir, fileName);
    await writeFile(fullPath, input.bytes);
    return {
      url: `/article-assets/${fileName}`,
      fileName,
      contentHash: hash,
      bytes: input.bytes.byteLength,
      mimeType: input.mimeType,
    };
  }
}

let defaultStore: AssetStore | null = null;

/** 工厂：当前仅 Local；部署时可换 Supabase/R2 实现 */
export function getAssetStore(): AssetStore {
  if (!defaultStore) {
    const driver = process.env.ASSET_STORE ?? "local";
    if (driver !== "local") {
      console.warn(`[AssetStore] 未知驱动 ${driver}，回退 local`);
    }
    defaultStore = new LocalAssetStore();
  }
  return defaultStore;
}

export function __setAssetStoreForTests(store: AssetStore | null) {
  defaultStore = store;
}
