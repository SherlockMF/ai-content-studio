/** 长文压缩：只保留标题、数据段、列表，供配图分析使用 */
export function prepareBodyForIllustrationAnalysis(body: string, maxChars = 4500) {
  if (body.length <= maxChars) return body;

  const picked: string[] = [];
  for (const line of body.split("\n")) {
    const text = line.trim();
    if (!text) continue;
    if (/^#{1,3}\s/.test(text)) {
      picked.push(text);
      continue;
    }
    if (
      /[\d,.]+\s*%|[\d,]+\s*人|公顷|绿地率|容积率|测评|测试|对比|vs|Parvis|Agent|Harness|工具|指标/i.test(
        text
      )
    ) {
      picked.push(text);
      continue;
    }
    if (text.startsWith("- ") || text.startsWith("> ")) {
      picked.push(text);
    }
    if (picked.join("\n").length >= maxChars) break;
  }

  const compact = picked.join("\n").slice(0, maxChars);
  return `${compact}\n\n（正文较长，已提取章节标题与含数据段落供配图分析）`;
}
