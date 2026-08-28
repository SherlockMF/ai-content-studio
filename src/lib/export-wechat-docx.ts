import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import {
  readImageDimensions,
  resolveMarkdownImage,
  scaleImageForWechat,
} from "@/lib/export-assets";

/** 公众号 Word 导入友好样式（docx 字号单位 = 半磅，22 ≈ 11pt） */
const WECHAT_FONT = "Microsoft YaHei";
const BODY_SIZE = 22;
const TABLE_SIZE = 20;
const HEADING2_SIZE = 28;
const HEADING3_SIZE = 24;
const CODE_SIZE = 20;

const BODY_SPACING = { before: 80, after: 80, line: 360 };
const TABLE_SPACING = { before: 40, after: 40, line: 280 };


function parseInline(text: string, size: number, forceBold = false): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(
        new TextRun({
          text: part.slice(2, -2),
          bold: true,
          size,
          font: WECHAT_FONT,
          color: "000000",
        })
      );
      continue;
    }
    const linkStripped = part.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    if (!linkStripped) continue;
    runs.push(
      new TextRun({
        text: linkStripped,
        bold: forceBold,
        size,
        font: WECHAT_FONT,
        color: "000000",
      })
    );
  }

  return runs.length > 0
    ? runs
    : [new TextRun({ text, size, font: WECHAT_FONT, color: "000000" })];
}

function paragraphFromText(text: string, options?: { bold?: boolean; size?: number }) {
  const size = options?.size ?? BODY_SIZE;
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: BODY_SPACING,
    children: options?.bold
      ? [
          new TextRun({
            text,
            bold: true,
            size,
            font: WECHAT_FONT,
            color: "000000",
          }),
        ]
      : parseInline(text, size),
  });
}

function headingParagraph(text: string, level: 2 | 3) {
  return new Paragraph({
    heading: level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    alignment: AlignmentType.LEFT,
    spacing: { before: 200, after: 120, line: 360 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: level === 2 ? HEADING2_SIZE : HEADING3_SIZE,
        font: WECHAT_FONT,
        color: "000000",
      }),
    ],
  });
}

function parseTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string) {
  const cells = parseTableRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

function buildTable(rows: string[][]) {
  const tableRows = rows.map((cells, rowIndex) => {
    const isHeader = rowIndex === 0;
    return new TableRow({
      children: cells.map(
        (cell) =>
          new TableCell({
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: TABLE_SPACING,
                children: [
                  new TextRun({
                    text: cell,
                    bold: isHeader,
                    size: TABLE_SIZE,
                    font: WECHAT_FONT,
                    color: "000000",
                  }),
                ],
              }),
            ],
          })
      ),
    });
  });

  return new Table({
    alignment: AlignmentType.CENTER,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  });
}

function detectImageType(bytes: Uint8Array): "png" | "jpg" | "gif" {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "gif";
  return "png";
}

async function imageParagraph(alt: string, url: string) {
  const resolved = await resolveMarkdownImage(url);
  if (!resolved) {
    return paragraphFromText(
      alt ? `[图片：${alt} — 请替换占位链接后重新导出]` : "[图片占位，请插入本地图后重新导出]",
      { size: CODE_SIZE }
    );
  }

  const dims = readImageDimensions(resolved.bytes) ?? { width: 520, height: 293 };
  const scaled = scaleImageForWechat(dims.width, dims.height);

  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
    children: [
      new ImageRun({
        type: detectImageType(resolved.bytes),
        data: resolved.bytes,
        transformation: { width: scaled.width, height: scaled.height },
      }),
    ],
  });
}

type Block =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "table"; rows: string[][] }
  | { kind: "code"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "image"; alt: string; url: string };

function parseMarkdownBlocks(body: string): Block[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed.startsWith("<!--")) {
      while (i < lines.length && !lines[i].includes("-->")) i += 1;
      i += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      i += 1;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ kind: "code", text: codeLines.join("\n") });
      continue;
    }

    const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      blocks.push({ kind: "image", alt: imageMatch[1], url: imageMatch[2] });
      i += 1;
      continue;
    }

    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i += 1;
      }
      const dataLines = tableLines.filter((l) => !isTableSeparator(l));
      const rows = dataLines.map(parseTableRow).filter((r) => r.some(Boolean));
      if (rows.length > 0) blocks.push({ kind: "table", rows });
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push({ kind: "heading", level: 3, text: trimmed.slice(4).trim() });
      i += 1;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push({ kind: "heading", level: 2, text: trimmed.slice(3).trim() });
      i += 1;
      continue;
    }

    if (trimmed.startsWith("# ")) {
      // 正文内一级标题降级为二级，避免与公众号标题栏重复
      blocks.push({ kind: "heading", level: 2, text: trimmed.slice(2).trim() });
      i += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ kind: "quote", text: quoteLines.join("\n") });
      continue;
    }

    const paraLines: string[] = [trimmed];
    i += 1;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (
        !next ||
        next.startsWith("#") ||
        next.startsWith("|") ||
        next.startsWith("```") ||
        next.startsWith("<!--") ||
        next.startsWith(">") ||
        /^!\[/.test(next)
      ) {
        break;
      }
      paraLines.push(next);
      i += 1;
    }
    blocks.push({ kind: "paragraph", text: paraLines.join("") });
  }

  return blocks;
}

async function blocksToDocChildren(blocks: Block[]) {
  const children: (Paragraph | Table)[] = [];

  for (const block of blocks) {
    switch (block.kind) {
      case "paragraph":
        children.push(paragraphFromText(block.text));
        break;
      case "heading":
        children.push(headingParagraph(block.text, block.level));
        break;
      case "table":
        children.push(buildTable(block.rows));
        break;
      case "code":
        children.push(
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: BODY_SPACING,
            indent: { left: 360 },
            children: [
              new TextRun({
                text: block.text,
                size: CODE_SIZE,
                font: "Consolas",
                color: "333333",
              }),
            ],
          })
        );
        break;
      case "quote":
        children.push(
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: BODY_SPACING,
            indent: { left: 360 },
            children: parseInline(block.text, BODY_SIZE),
          })
        );
        break;
      case "image":
        children.push(await imageParagraph(block.alt, block.url));
        break;
      default:
        break;
    }
  }

  return children;
}

export function buildWechatPublishClipboard(input: { title: string; digest?: string }) {
  const lines = [`标题：${input.title.trim()}`];
  if (input.digest?.trim()) lines.push(`摘要：${input.digest.trim()}`);
  lines.push("", "正文请导入同目录下的 Word 文件（不含标题，图片已内嵌）。");
  return lines.join("\n");
}

/** 导出公众号可导入的 Word（正文无标题、图片内嵌、表格居中且字号更小、加粗更明显） */
export async function buildWechatDocxBundle(input: {
  title: string;
  digest?: string;
  body: string;
  fileBaseName?: string;
}) {
  const blocks = parseMarkdownBlocks(input.body.trim());
  const children = await blocksToDocChildren(blocks);

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: WECHAT_FONT,
            size: BODY_SIZE,
            color: "000000",
          },
          paragraph: {
            spacing: BODY_SPACING,
          },
        },
      },
    },
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  const base =
    input.fileBaseName?.trim() ||
    input.title.trim().slice(0, 36).replace(/[\\/:*?"<>|]/g, "_") ||
    "wechat-article";

  return {
    blob,
    fileName: `${base}-公众号正文.docx`,
    clipboardText: buildWechatPublishClipboard(input),
  };
}
