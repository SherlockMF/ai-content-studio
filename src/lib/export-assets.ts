export const IMAGE_MD_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
export const PLACEHOLDER_RE = /待替换|upload.*填链接|fill.*link|placeholder/i;

export function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { bytes, ext, mime };
}

export async function fetchLocalAsset(pathname: string) {
  const url = pathname.startsWith("http") ? pathname : `${window.location.origin}${pathname}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`无法读取图片：${pathname}`);
  return {
    bytes: new Uint8Array(await res.arrayBuffer()),
    fileName: pathname.split("/").pop() ?? "image.png",
  };
}

export async function resolveMarkdownImage(url: string) {
  const rawUrl = url.trim();
  if (!rawUrl || PLACEHOLDER_RE.test(rawUrl)) return null;

  if (rawUrl.startsWith("data:image")) {
    const parsed = parseDataUrl(rawUrl);
    if (!parsed) return null;
    return { bytes: parsed.bytes, alt: "" };
  }

  if (rawUrl.startsWith("/article-assets/") || rawUrl.startsWith("/brand-icons/")) {
    const fetched = await fetchLocalAsset(rawUrl);
    return { bytes: fetched.bytes, alt: "" };
  }

  return null;
}

/** 从 PNG/JPEG 头读取宽高，用于 Word 内嵌图比例 */
export function readImageDimensions(bytes: Uint8Array) {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    const width =
      (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
    const height =
      (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    if (width > 0 && height > 0) return { width, height };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (marker === 0xc0 || marker === 0xc2) {
        const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
        const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
        if (width > 0 && height > 0) return { width, height };
      }
      offset += 2 + length;
    }
  }
  return null;
}

export function scaleImageForWechat(width: number, height: number, maxWidth = 520) {
  if (width <= maxWidth) return { width, height };
  const ratio = maxWidth / width;
  return { width: maxWidth, height: Math.round(height * ratio) };
}
