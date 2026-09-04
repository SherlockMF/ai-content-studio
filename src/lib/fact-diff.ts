/** 测评稿事实保护：从正文抽取数字/专有名词，润色后 Diff */

import type { FactDiffSnapshot } from "@/types/domain";

export type FactKind = "number" | "percent" | "entity";

export interface FactToken {
  kind: FactKind;
  /** 规范化后的可比对值 */
  value: string;
  /** 原文中的展示形式 */
  raw: string;
}

export interface FactDiffItem {
  kind: FactKind;
  severity: "critical" | "warning";
  status: "missing" | "added" | "changed";
  before?: string;
  after?: string;
  message: string;
}

export interface FactDiffReport {
  beforeCount: number;
  afterCount: number;
  items: FactDiffItem[];
  /** 存在 critical 变更时不可进入「待发布」 */
  blocking: boolean;
  summary: string;
}

const KNOWN_ENTITIES = [
  "Parvis",
  "Codex",
  "WorkBuddy",
  "Cola",
  "August",
  "GLM",
  "Qwen",
  "GPT 5.6 Sol",
  "GPT-5.6 Sol",
  "GPT 5.6",
  "haidian",
  "Urban Design Skill",
  "Benchmark",
  "GIS",
  "FAR",
  "Auto",
];

function stripMarkdownListMarkers(text: string): string {
  return text.replace(/^\s*\d+\.\s+/gm, "");
}

const CN_DIGIT: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

function chineseNumeralToInt(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (s === "十") return 10;
  if (s.endsWith("十") && s.length === 2) {
    const head = CN_DIGIT[s[0]!];
    return head != null ? head * 10 : null;
  }
  if (s.includes("十")) {
    const [left, right] = s.split("十");
    const tens = left ? CN_DIGIT[left] ?? (left === "" ? 1 : null) : 1;
    const ones = right ? CN_DIGIT[right] ?? 0 : 0;
    if (tens == null) return null;
    return tens * 10 + ones;
  }
  if (s.length === 1 && CN_DIGIT[s] != null) return CN_DIGIT[s]!;
  return null;
}

function extractItemCountTokens(text: string): FactToken[] {
  const tokens: FactToken[] = [];
  const digitItemRe = /(?<![\w./-])(\d{1,4})\s*项/g;
  for (const m of text.matchAll(digitItemRe)) {
    const raw = m[0].trim();
    tokens.push({ kind: "number", value: `item:${m[1]}`, raw });
  }
  const cnItemRe = /([一二三四五六七八九十百]+)\s*项/g;
  for (const m of text.matchAll(cnItemRe)) {
    const n = chineseNumeralToInt(m[1] ?? "");
    if (n == null) continue;
    tokens.push({ kind: "number", value: `item:${n}`, raw: m[0].trim() });
  }
  return tokens;
}

function isPercentDuplicate(numValue: string, percentValues: Set<string>): boolean {
  const n = parseFloat(numValue.replace(/,/g, ""));
  if (!Number.isFinite(n)) return false;
  for (const p of percentValues) {
    const pn = parseFloat(p.replace(/%$/, ""));
    if (Number.isFinite(pn) && Math.abs(pn - n) < 0.0001) return true;
  }
  return false;
}

function normalizeNumberToken(raw: string): string {
  let s = raw.replace(/,/g, "").replace(/\s+/g, "");
  // 统一全角数字
  s = s.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30));
  if (/%$/.test(s) || /％$/.test(s)) {
    const n = parseFloat(s.replace(/[％%]/g, ""));
    return Number.isFinite(n) ? `${n}%` : s;
  }
  // 万㎡ / 万人 等量级：保留数值部分
  const match = s.match(/^([\d.]+)/);
  if (!match) return s;
  const n = parseFloat(match[1]);
  return Number.isFinite(n) ? String(n) : s;
}

function extractNumbers(text: string): FactToken[] {
  const source = stripMarkdownListMarkers(text);
  const tokens: FactToken[] = [];
  const percentValues = new Set<string>();

  const percentRe = /\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*[%％]/g;
  for (const m of source.matchAll(percentRe)) {
    const raw = m[0].trim();
    const value = normalizeNumberToken(raw);
    percentValues.add(value);
    tokens.push({ kind: "percent", value, raw });
  }

  tokens.push(...extractItemCountTokens(source));

  const numRe =
    /(?<![\w./-])(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d{1,4}|\d{2,})(?![\w./-])/g;
  for (const m of source.matchAll(numRe)) {
    const raw = m[1] ?? "";
    const index = m.index ?? 0;
    if (/%|％/.test(m[0])) continue;
    if (/^\s*项/.test(source.slice(index + m[0].length))) continue;
    const value = normalizeNumberToken(raw);
    if (isPercentDuplicate(value, percentValues)) continue;
    tokens.push({ kind: "number", value, raw });
  }
  return tokens;
}

function extractEntities(text: string): FactToken[] {
  const tokens: FactToken[] = [];
  for (const name of KNOWN_ENTITIES) {
    const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    if (re.test(text)) {
      tokens.push({ kind: "entity", value: name.toLowerCase(), raw: name });
    }
  }
  // 额外抓「模型名 + 版本」形态：如 GLM 5.3 Flash
  const modelRe = /\b(?:GLM|Qwen|GPT)[\s-]?\d+(?:\.\d+)?(?:\s*(?:Flash|Sol|Pro|Turbo))?\b/gi;
  for (const m of text.matchAll(modelRe)) {
    const raw = m[0].trim();
    tokens.push({
      kind: "entity",
      value: raw.toLowerCase().replace(/\s+/g, " "),
      raw,
    });
  }
  return tokens;
}

function countMap(tokens: FactToken[]) {
  const map = new Map<string, { count: number; kind: FactKind; raw: string }>();
  for (const t of tokens) {
    const key = `${t.kind}:${t.value}`;
    const prev = map.get(key);
    if (prev) prev.count += 1;
    else map.set(key, { count: 1, kind: t.kind, raw: t.raw });
  }
  return map;
}

export function extractFacts(text: string): FactToken[] {
  return [...extractNumbers(text), ...extractEntities(text)];
}

/** 对比润色前后事实；critical = 数值丢失/变化；warning = 专有名词变化或新增数字 */
export function diffFacts(before: string, after: string): FactDiffReport {
  const beforeMap = countMap(extractFacts(before));
  const afterMap = countMap(extractFacts(after));
  const items: FactDiffItem[] = [];

  for (const [key, info] of beforeMap) {
    const afterInfo = afterMap.get(key);
    if (!afterInfo) {
      items.push({
        kind: info.kind,
        severity: info.kind === "entity" ? "warning" : "critical",
        status: "missing",
        before: info.raw,
        message:
          info.kind === "entity"
            ? `专有名词「${info.raw}」在改稿中消失或改写`
            : `数值「${info.raw}」在改稿中消失或被改写`,
      });
      continue;
    }
    if (afterInfo.count < info.count) {
      items.push({
        kind: info.kind,
        severity: info.kind === "number" || info.kind === "percent" ? "critical" : "warning",
        status: "changed",
        before: info.raw,
        after: afterInfo.raw,
        message: `「${info.raw}」出现次数减少（${info.count} → ${afterInfo.count}）`,
      });
    }
  }

  // 同 kind 下 value 近似但不同：检测「改了一个数字」
  const beforeNums = [...beforeMap.entries()].filter(([k]) => k.startsWith("number:") || k.startsWith("percent:"));
  const afterNums = [...afterMap.entries()].filter(([k]) => k.startsWith("number:") || k.startsWith("percent:"));
  for (const [bKey, bInfo] of beforeNums) {
    if (afterMap.has(bKey)) continue;
    if (bKey.startsWith("number:item:") || bKey.startsWith("percent:")) continue;
    const bVal = bKey.split(":")[1] ?? "";
    for (const [aKey, aInfo] of afterNums) {
      if (beforeMap.has(aKey)) continue;
      if (aKey.startsWith("number:item:") || aKey.startsWith("percent:")) continue;
      const aVal = aKey.split(":")[1] ?? "";
      if (bVal.length >= 3 && aVal.length >= 3 && Math.abs(bVal.length - aVal.length) <= 1) {
        items.push({
          kind: bInfo.kind,
          severity: "critical",
          status: "changed",
          before: bInfo.raw,
          after: aInfo.raw,
          message: `疑似数值被改写：${bInfo.raw} → ${aInfo.raw}`,
        });
        break;
      }
    }
  }

  // 去重 message
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const k = `${item.status}:${item.before ?? ""}:${item.after ?? ""}:${item.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const blocking = unique.some((i) => i.severity === "critical");
  const summary = unique.length === 0
    ? "事实核对通过：数字与关键专有名词未发现异常变化"
    : blocking
      ? `发现 ${unique.filter((i) => i.severity === "critical").length} 处关键事实变更，发布前需人工确认`
      : `发现 ${unique.length} 处需留意的专有名词变化`;

  return {
    beforeCount: beforeMap.size,
    afterCount: afterMap.size,
    items: unique,
    blocking,
    summary,
  };
}

export function formatFactDiffForNotes(report: FactDiffReport) {
  if (report.items.length === 0) return report.summary;
  const lines = report.items.slice(0, 8).map((item) => {
    if (item.status === "changed" && item.before && item.after) {
      return `${item.before} → ${item.after}`;
    }
    return item.message;
  });
  return `${report.summary}｜${lines.join("；")}`;
}

export function toFactSnapshot(
  report: FactDiffReport,
  acknowledgedAt?: string
): FactDiffSnapshot {
  return {
    blocking: report.blocking,
    summary: report.summary,
    itemCount: report.items.length,
    items: report.items.map((item) => ({ ...item })),
    acknowledgedAt,
    createdAt: new Date().toISOString(),
  };
}

export function factSnapshotToReport(
  snapshot: FactDiffSnapshot,
  beforeCount = 0,
  afterCount = 0
): FactDiffReport {
  const items: FactDiffItem[] = (snapshot.items ?? []).map((item) => ({ ...item }));
  return {
    beforeCount,
    afterCount,
    items,
    blocking: snapshot.blocking,
    summary: snapshot.summary,
  };
}
