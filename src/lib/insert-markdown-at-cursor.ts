/** 在 Markdown 文本框光标处插入内容 */
export function insertMarkdownAtCursor(
  current: string,
  snippet: string,
  selection: { start: number; end: number }
) {
  const { start, end } = selection;
  const next = `${current.slice(0, start)}${snippet}${current.slice(end)}`;
  const cursor = start + snippet.length;
  return { next, cursor };
}
