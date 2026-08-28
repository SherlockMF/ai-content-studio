export interface ParsedMarkdownDraft {
  title: string;
  digest?: string;
  body: string;
}

/** 从 Markdown 解析标题、摘要与正文（支持 # 标题、> 摘要） */
export function parseMarkdownDraft(raw: string): ParsedMarkdownDraft {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  let title = "";
  let digest: string | undefined;
  const bodyLines: string[] = [];
  let i = 0;

  while (i < lines.length && !lines[i].trim()) i++;

  if (i < lines.length && lines[i].startsWith("# ")) {
    title = lines[i].slice(2).trim();
    i++;
  }

  while (i < lines.length && !lines[i].trim()) i++;

  if (i < lines.length && lines[i].startsWith("> ")) {
    digest = lines[i].slice(2).trim();
    i++;
  }

  while (i < lines.length && !lines[i].trim()) i++;

  bodyLines.push(...lines.slice(i));
  const body = bodyLines.join("\n").trim();

  if (!title && body) {
    const firstLine = body.split("\n")[0]?.replace(/^#+\s*/, "").trim();
    title = firstLine || "未命名稿件";
  }

  return { title: title || "未命名稿件", digest, body: body || raw.trim() };
}
