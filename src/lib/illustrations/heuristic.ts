import { IllustrationSuggestion } from "@/lib/illustrations/insert";

const IMAGE_KINDS = ["数据图表", "流程示意图", "概念插图", "对比图", "架构图"] as const;
type ImageKind = (typeof IMAGE_KINDS)[number];

function normalizeImageKind(value: string): ImageKind {
  const v = value.trim();
  if ((IMAGE_KINDS as readonly string[]).includes(v)) return v as ImageKind;
  if (/数据|图表|指标|数字|对比|柱状/.test(v)) return "数据图表";
  if (/流程|步骤|链路|工作流/.test(v)) return "流程示意图";
  if (/架构|系统|模块|插件/.test(v)) return "架构图";
  if (/对比|差异|前后/.test(v)) return "对比图";
  return "概念插图";
}

export function normalizeIllustrationSuggestion(
  raw: {
    id?: string | number;
    placementLabel: string;
    anchorSnippet: string;
    reason: string;
    imageKind: string;
    gptPrompt: string;
    altText?: string;
  },
  index: number
): IllustrationSuggestion {
  return {
    id: String(raw.id || `illus_${index + 1}`),
    placementLabel: raw.placementLabel,
    anchorSnippet: raw.anchorSnippet.trim(),
    reason: raw.reason,
    imageKind: normalizeImageKind(raw.imageKind),
    gptPrompt: raw.gptPrompt,
    altText: raw.altText?.trim() || raw.placementLabel,
  };
}

function pickAnchor(text: string) {
  const line =
    text.split("\n").find((l) => {
      const t = l.trim();
      return t.length >= 12 && !/^#{1,3}\s/.test(t);
    }) ?? text;
  return line.trim().slice(0, 72);
}

/** LLM 失败时的规则兜底：从数据段与章节标题生成配图建议 */
export function heuristicIllustrationSuggestions(title: string, body: string) {
  const suggestions: IllustrationSuggestion[] = [];
  const seen = new Set<string>();

  const paragraphs = body.split(/\n\n+/);
  for (const para of paragraphs) {
    if (!/[\d,.]+\s*%|[\d,]+\s*人|公顷|绿地率|约\s*[\d,.]+/i.test(para)) continue;
    const anchor = pickAnchor(para);
    if (anchor.length < 12 || seen.has(anchor)) continue;
    seen.add(anchor);
    suggestions.push({
      id: `h_data_${suggestions.length + 1}`,
      placementLabel: `数据段落后：${anchor.slice(0, 24)}…`,
      anchorSnippet: anchor,
      reason: "段落含具体数字或指标，适合用信息图呈现对比。",
      imageKind: "数据图表",
      gptPrompt: [
        "简约扁平信息图，浅色背景，适合微信公众号配图。",
        `文章主题：${title}。`,
        `画面内容：根据以下数据要点绘制对比图或指标卡片，中文标注，不要写实照片。`,
        para.replace(/\n/g, " ").slice(0, 280),
      ].join(" "),
      altText: "数据对比示意图",
    });
    if (suggestions.length >= 2) break;
  }

  const headings = [...body.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
  for (const heading of headings) {
    if (suggestions.length >= 4) break;
    const marker = `## ${heading}`;
    const start = body.indexOf(marker);
    if (start === -1) continue;
    const end = body.indexOf("\n## ", start + marker.length);
    const section = body.slice(start, end === -1 ? start + 600 : end);
    const anchor = pickAnchor(section.split("\n").slice(1).join("\n"));
    if (anchor.length < 12 || seen.has(anchor)) continue;
    seen.add(anchor);

    const isData = /数据|指标|计算|对比|%/i.test(section);
    suggestions.push({
      id: `h_sec_${suggestions.length + 1}`,
      placementLabel: `章节「${heading}」`,
      anchorSnippet: anchor,
      reason: isData
        ? "该章节含测评或数据结论，可用图表辅助理解。"
        : "该章节为核心论点，可用概念图或流程图辅助阅读。",
      imageKind: isData ? "数据图表" : "概念插图",
      gptPrompt: [
        "简约扁平插画或信息图，浅色背景，适合微信公众号。",
        `文章：${title}，章节：${heading}。`,
        `画面表达本章核心观点，中文标注，风格清晰克制，非写实照片。`,
        anchor,
      ].join(" "),
      altText: `${heading}示意图`,
    });
  }

  if (!suggestions.length) {
    const anchor = pickAnchor(body);
    suggestions.push({
      id: "h_default_1",
      placementLabel: "文首核心观点后",
      anchorSnippet: anchor,
      reason: "可用一张总览概念图帮助读者把握全文结构。",
      imageKind: "概念插图",
      gptPrompt: `简约扁平概念插图，浅色背景，微信公众号配图。主题：${title}。表达文章核心观点，中文标注，非写实照片。`,
      altText: "文章概念示意图",
    });
  }

  return {
    summary: "已使用本地规则生成配图建议（模型返回异常时的兜底）。提示词可自行调整后复制到 GPT 生图。",
    suggestions: suggestions.slice(0, 4),
  };
}
