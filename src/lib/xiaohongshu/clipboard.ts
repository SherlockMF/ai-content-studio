/** 用真实 br 表达每个换行，避免目标编辑器丢弃 Markdown 段落样式后挤成一段。 */
export function buildNoteClipboardHtml(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div>${escaped.replace(/\r\n?|\n/g, "<br>")}</div>`;
}

export async function copyNotePreservingLines(
  text: string,
  clipboard: Pick<Clipboard, "writeText"> & Partial<Pick<Clipboard, "write">> = navigator.clipboard
) {
  if (clipboard.write && typeof ClipboardItem !== "undefined") {
    try {
      await clipboard.write([new ClipboardItem({
        "text/plain": new Blob([text], { type: "text/plain" }),
        "text/html": new Blob([buildNoteClipboardHtml(text)], { type: "text/html" }),
      })]);
      return;
    } catch {
      // 不支持富文本剪贴板的浏览器仍可复制含原始换行的纯文本。
    }
  }
  await clipboard.writeText(text);
}
