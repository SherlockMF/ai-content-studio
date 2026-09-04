import type {
  BlockContent,
  ListItem,
  PhrasingContent,
  Root,
  Table,
  TableCell as MdTableCell,
} from "mdast";
import {
  AlignmentType,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table as DocxTable,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import {
  detectImageType,
  readImageDimensions,
  resolveMarkdownImage,
  scaleImageForWechat,
} from "@/lib/export-assets";
import { parseMarkdownToAst } from "@/lib/markdown/parse";

const WECHAT_FONT = "Microsoft YaHei";
const BODY_SIZE = 22;
const TABLE_SIZE = 20;
const HEADING2_SIZE = 28;
const HEADING3_SIZE = 24;
const CODE_SIZE = 20;
const BODY_SPACING = { before: 0, after: 280, line: 360 };
const TABLE_SPACING = { before: 40, after: 40, line: 280 };

function phrasingToPlain(nodes: PhrasingContent[]): string {
  let text = "";
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        text += node.value;
        break;
      case "strong":
      case "emphasis":
      case "delete":
      case "link":
        text += phrasingToPlain(node.children);
        break;
      case "inlineCode":
        text += node.value;
        break;
      case "break":
        text += "\n";
        break;
      default:
        break;
    }
  }
  return text;
}

async function phrasingToRuns(
  nodes: PhrasingContent[],
  size: number,
  options: { forceBold?: boolean } = {}
): Promise<TextRun[]> {
  const runs: TextRun[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        runs.push(
          new TextRun({
            text: node.value,
            size,
            font: WECHAT_FONT,
            color: "000000",
            bold: options.forceBold || undefined,
          })
        );
        break;
      case "strong":
        runs.push(...(await phrasingToRuns(node.children, size, { forceBold: true })));
        break;
      case "emphasis":
        for (const child of node.children) {
          if (child.type === "text") {
            runs.push(
              new TextRun({
                text: child.value,
                italics: true,
                size,
                font: WECHAT_FONT,
                color: "000000",
                bold: options.forceBold || undefined,
              })
            );
          } else {
            runs.push(
              ...(await phrasingToRuns([child], size, {
                forceBold: options.forceBold,
              }))
            );
          }
        }
        break;
      case "inlineCode":
        runs.push(
          new TextRun({
            text: node.value,
            size: CODE_SIZE,
            font: "Consolas",
            color: "333333",
            bold: options.forceBold || undefined,
          })
        );
        break;
      case "link":
        runs.push(
          ...(await phrasingToRuns(node.children, size, {
            forceBold: options.forceBold,
          }))
        );
        break;
      case "delete":
        for (const child of node.children) {
          if (child.type === "text") {
            runs.push(
              new TextRun({
                text: child.value,
                strike: true,
                size,
                font: WECHAT_FONT,
                color: "000000",
                bold: options.forceBold || undefined,
              })
            );
          } else {
            runs.push(
              ...(await phrasingToRuns([child], size, {
                forceBold: options.forceBold,
              }))
            );
          }
        }
        break;
      case "break":
        runs.push(new TextRun({ break: 1 }));
        break;
      default:
        break;
    }
  }
  return runs;
}

async function imageParagraph(url: string, alt?: string) {
  const resolved = await resolveMarkdownImage(url);
  if (!resolved) {
    const label = alt?.trim() ? `[配图占位：${alt.trim()}]` : "[配图占位]";
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: BODY_SPACING,
      children: [
        new TextRun({
          text: label,
          size: CODE_SIZE,
          font: WECHAT_FONT,
          color: "666666",
          italics: true,
        }),
      ],
    });
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

/** 把 <!-- GPT 配图提示词 ... --> 提成可复制正文（Word 工作稿用） */
export function extractGptImagePromptComment(html: string): string | null {
  const trimmed = html.trim();
  const match = trimmed.match(/^<!--\s*([\s\S]*?)\s*-->$/);
  if (!match) return null;
  const body = match[1]!.trim();
  if (!/GPT\s*配图提示词/i.test(body)) return null;
  return body;
}

function gptPromptParagraphs(promptText: string): Paragraph[] {
  const lines = promptText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map(
    (line, index) =>
      new Paragraph({
        spacing:
          index === 0
            ? { before: 80, after: 40, line: 320 }
            : { before: 0, after: 40, line: 320 },
        children: [
          new TextRun({
            text: line,
            size: CODE_SIZE,
            font: WECHAT_FONT,
            color: "666666",
          }),
        ],
      })
  );
}

async function tableToDocx(node: Table) {
  const rows = await Promise.all(
    node.children.map(async (row, rowIndex) => {
      const cells = await Promise.all(
        row.children.map(async (cell: MdTableCell) => {
          const plain = phrasingToPlain(cell.children);
          return new TableCell({
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: TABLE_SPACING,
                children: [
                  new TextRun({
                    text: plain,
                    bold: rowIndex === 0,
                    size: TABLE_SIZE,
                    font: WECHAT_FONT,
                    color: "000000",
                  }),
                ],
              }),
            ],
          });
        })
      );
      return new TableRow({ children: cells });
    })
  );

  return new DocxTable({
    alignment: AlignmentType.CENTER,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}

async function listItemParagraph(
  node: ListItem,
  ordered: boolean,
  index: number
) {
  const textParts: string[] = [];
  for (const child of node.children) {
    if (child.type === "paragraph") {
      textParts.push(phrasingToPlain(child.children));
    }
  }
  const marker = ordered ? `${index + 1}. ` : "• ";
  return new Paragraph({
    spacing: BODY_SPACING,
    children: [
      new TextRun({
        text: marker + textParts.join(""),
        size: BODY_SIZE,
        font: WECHAT_FONT,
      }),
    ],
  });
}

async function blockToDocx(
  node: BlockContent,
  options: { stripH1?: boolean }
): Promise<(Paragraph | DocxTable)[]> {
  switch (node.type) {
    case "paragraph": {
      if (node.children.length === 0) return [];
      const blocks: (Paragraph | DocxTable)[] = [];
      for (const child of node.children) {
        if (child.type === "image") {
          blocks.push(await imageParagraph(child.url, child.alt ?? undefined));
        }
      }
      const textNodes = node.children.filter((c) => c.type !== "image") as PhrasingContent[];
      if (textNodes.length > 0) {
        blocks.unshift(
          new Paragraph({
            spacing: BODY_SPACING,
            children: await phrasingToRuns(textNodes, BODY_SIZE),
          })
        );
      }
      return blocks;
    }
    case "heading": {
      // 不用 Word 内置 Heading 样式：导入公众号会被主题色染成蓝且加粗常丢
      if (options.stripH1 !== false && node.depth === 1) {
        return [
          new Paragraph({
            spacing: { before: 200, after: 120, line: 360 },
            children: await phrasingToRuns(node.children, HEADING2_SIZE, {
              forceBold: true,
            }),
          }),
        ];
      }
      const size =
        node.depth === 2 ? HEADING2_SIZE : node.depth === 3 ? HEADING3_SIZE : BODY_SIZE;
      return [
        new Paragraph({
          spacing: { before: 200, after: 120, line: 360 },
          children: await phrasingToRuns(node.children, size, { forceBold: true }),
        }),
      ];
    }
    case "blockquote": {
      const inner: (Paragraph | DocxTable)[] = [];
      for (const child of node.children as BlockContent[]) {
        inner.push(...(await blockToDocx(child, options)));
      }
      return inner;
    }
    case "code":
      return [
        new Paragraph({
          spacing: BODY_SPACING,
          indent: { left: 360 },
          children: [
            new TextRun({
              text: node.value,
              size: CODE_SIZE,
              font: "Consolas",
              color: "333333",
            }),
          ],
        }),
      ];
    case "list": {
      return Promise.all(
        node.children.map((item, idx) =>
          listItemParagraph(item, Boolean(node.ordered), idx)
        )
      );
    }
    case "table":
      return [await tableToDocx(node)];
    case "thematicBreak":
      return [
        new Paragraph({
          spacing: BODY_SPACING,
          children: [new TextRun({ text: "— — —", font: WECHAT_FONT })],
        }),
      ];
    case "html": {
      const prompt = extractGptImagePromptComment(node.value);
      if (prompt) return gptPromptParagraphs(prompt);
      return [];
    }
    default:
      return [];
  }
}

async function astToDocxChildren(ast: Root, options: { stripH1?: boolean }) {
  const children: (Paragraph | DocxTable)[] = [];

  for (const node of ast.children) {
    if (node.type === "definition") continue;
    if (
      node.type === "paragraph" ||
      node.type === "heading" ||
      node.type === "blockquote" ||
      node.type === "code" ||
      node.type === "list" ||
      node.type === "table" ||
      node.type === "thematicBreak" ||
      node.type === "html"
    ) {
      children.push(...(await blockToDocx(node, options)));
    }
  }

  return children;
}

export async function renderWechatDocxFromMarkdown(
  markdown: string,
  options: { stripH1?: boolean } = {}
) {
  const ast = parseMarkdownToAst(markdown);
  return astToDocxChildren(ast, options);
}

export async function buildWechatDocxBlob(children: (Paragraph | DocxTable)[]) {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: WECHAT_FONT, size: BODY_SIZE, color: "000000" },
          paragraph: { spacing: BODY_SPACING },
        },
      },
    },
    sections: [{ properties: {}, children }],
  });
  return Packer.toBlob(doc);
}
