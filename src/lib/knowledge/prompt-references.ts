const MAX_REFERENCES = 8;
const MAX_REFERENCE_CHARS = 1_800;
const MAX_TOTAL_CHARS = 9_000;

export function formatKnowledgeReferences(input: unknown) {
  if (!Array.isArray(input)) return [];
  const formatted: string[] = [];
  let totalChars = 0;

  for (const raw of input.slice(0, MAX_REFERENCES)) {
    if (!raw || typeof raw !== "object") continue;
    const sourceTitle = "sourceTitle" in raw && typeof raw.sourceTitle === "string"
      ? raw.sourceTitle.trim().slice(0, 120)
      : "未命名资料";
    const content = "content" in raw && typeof raw.content === "string"
      ? raw.content.trim().slice(0, MAX_REFERENCE_CHARS)
      : "";
    if (!content) continue;
    const remaining = MAX_TOTAL_CHARS - totalChars;
    if (remaining <= 0) break;
    const body = content.slice(0, remaining);
    formatted.push(`[知识库来源：${sourceTitle}]\n${body}`);
    totalChars += body.length;
  }
  return formatted;
}
