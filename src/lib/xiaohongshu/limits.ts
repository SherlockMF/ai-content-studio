/** 小红书图文标题最大字数（按 Unicode 码点计） */
export const XIAOHONGSHU_TITLE_MAX_CHARS = 20;

/** 小红书图文正文最大字数（按 Unicode 码点计，含文末 #话题，不含标题） */
export const XIAOHONGSHU_BODY_MAX_CHARS = 1000;

export function countXiaohongshuChars(text: string): number {
  return Array.from(text).length;
}

/** 截断到上限；不 trim，便于编辑时保留空格与换行 */
export function clampXiaohongshuTitle(title: string): string {
  return Array.from(title).slice(0, XIAOHONGSHU_TITLE_MAX_CHARS).join("");
}

export function clampXiaohongshuBody(body: string): string {
  return Array.from(body).slice(0, XIAOHONGSHU_BODY_MAX_CHARS).join("");
}
