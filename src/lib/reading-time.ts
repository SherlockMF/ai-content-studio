/** 公众号阅读时长估算与出稿/润色约束 */

export type ReadingProfile = "general" | "professional" | "evaluation";

export type ReadingTimeStatus = "too_short" | "ideal" | "long" | "too_long";

export interface ReadingProfileSpec {
  label: string;
  /** 可接受下限（分钟） */
  minMinutes: number;
  /** 理想区间 */
  idealMinMinutes: number;
  idealMaxMinutes: number;
  /** 可接受上限（分钟） */
  maxMinutes: number;
  /** 每分钟可读字数（含标点，Markdown 已剥离） */
  charsPerMinute: number;
}

export const READING_PROFILES: Record<ReadingProfile, ReadingProfileSpec> = {
  general: {
    label: "观点/通识",
    minMinutes: 6,
    idealMinMinutes: 8,
    idealMaxMinutes: 12,
    maxMinutes: 15,
    charsPerMinute: 450,
  },
  professional: {
    label: "专业方法论",
    minMinutes: 8,
    idealMinMinutes: 10,
    idealMaxMinutes: 15,
    maxMinutes: 18,
    charsPerMinute: 400,
  },
  evaluation: {
    label: "测评/深度案例",
    minMinutes: 8,
    idealMinMinutes: 8,
    idealMaxMinutes: 14,
    maxMinutes: 18,
    charsPerMinute: 380,
  },
};

export interface ReadingTimeAnalysis {
  profile: ReadingProfile;
  profileLabel: string;
  charCount: number;
  minutes: number;
  minutesRange: [number, number];
  status: ReadingTimeStatus;
  statusLabel: string;
  guidance: string;
}

/** 剥离 Markdown 标记后统计正文字数 */
export function countReadableChars(body: string) {
  const text = body
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~`>#|-]/g, "")
    .replace(/\s+/g, "")
    .trim();
  return text.length;
}

export function resolveReadingProfile(input: {
  isEvaluation?: boolean;
  section?: string;
}): ReadingProfile {
  if (input.isEvaluation) return "evaluation";
  if (input.section === "行业观察" || input.section === "工具与工作流") {
    return "professional";
  }
  return "general";
}

export function analyzeReadingTime(
  body: string,
  profile: ReadingProfile = "general"
): ReadingTimeAnalysis {
  const spec = READING_PROFILES[profile];
  const charCount = countReadableChars(body);
  const minutes = Math.max(1, Math.round(charCount / spec.charsPerMinute));
  const fastMinutes = Math.round(charCount / (spec.charsPerMinute + 80));
  const slowMinutes = Math.round(charCount / (spec.charsPerMinute - 60));

  let status: ReadingTimeStatus = "ideal";
  if (minutes < spec.minMinutes) status = "too_short";
  else if (minutes > spec.maxMinutes) status = "too_long";
  else if (minutes > spec.idealMaxMinutes) status = "long";
  else if (minutes >= spec.idealMinMinutes && minutes <= spec.idealMaxMinutes) status = "ideal";

  const statusLabel: Record<ReadingTimeStatus, string> = {
    too_short: "偏短",
    ideal: "时长合适",
    long: "偏长",
    too_long: "过长",
  };

  const guidance = buildHumanGuidance(spec, status, minutes, charCount);

  return {
    profile,
    profileLabel: spec.label,
    charCount,
    minutes,
    minutesRange: [fastMinutes, slowMinutes],
    status,
    statusLabel: statusLabel[status],
    guidance,
  };
}

function buildHumanGuidance(
  spec: ReadingProfileSpec,
  status: ReadingTimeStatus,
  minutes: number,
  charCount: number
) {
  const idealChars = `${Math.round(spec.idealMinMinutes * spec.charsPerMinute)}–${Math.round(spec.idealMaxMinutes * spec.charsPerMinute)} 字`;

  switch (status) {
    case "too_short":
      return `当前约 ${minutes} 分钟（${charCount} 字），低于 ${spec.label} 建议下限 ${spec.minMinutes} 分钟。可补充具体场景、对比或可执行结论，避免空泛。`;
    case "ideal":
      return `当前约 ${minutes} 分钟（${charCount} 字），落在 ${spec.label} 理想区间 ${spec.idealMinMinutes}–${spec.idealMaxMinutes} 分钟（${idealChars}）。保持信息密度，优先优化表达节奏。`;
    case "long":
      return `当前约 ${minutes} 分钟（${charCount} 字），略超理想上限 ${spec.idealMaxMinutes} 分钟。可合并重复过渡、删套话，但保留数据与结论；文首确保有 30 秒可扫读的结论段。`;
    case "too_long":
      return `当前约 ${minutes} 分钟（${charCount} 字），超过 ${spec.label} 建议上限 ${spec.maxMinutes} 分钟。需压缩冗余表述、合并相近段落；测评稿保留全部数据，可增「3 分钟版结论」供跳读。`;
  }
}

/** 出稿时注入 LLM 的阅读时长约束 */
export function buildReadingTimeGeneratePrompt(profile: ReadingProfile) {
  const spec = READING_PROFILES[profile];
  return `
阅读时长目标（${spec.label}）：
- 理想完读：${spec.idealMinMinutes}–${spec.idealMaxMinutes} 分钟（约 ${Math.round(spec.idealMinMinutes * spec.charsPerMinute)}–${Math.round(spec.idealMaxMinutes * spec.charsPerMinute)} 字）
- 硬上限：${spec.maxMinutes} 分钟（约 ${Math.round(spec.maxMinutes * spec.charsPerMinute)} 字）

结构效率要求：
1. 开头 150 字内给出核心结论（可扫读，30–45 秒）。
2. 用叙事段落推进，禁止「一、二、三」章节编号；小节之间靠过渡句连接。
3. 数据/对比优先嵌进句子或一张表格，少用大段列表和引用块。
4. 结尾 1–2 段收束，不重复前文已说过的判断。
5. 在保证信息完整前提下，句子偏短、一段 1–3 句，减少「不是 A 而是 B」式翻案腔。`.trim();
}

/** 润色/去 AI 味时注入的阅读效率约束 */
export function buildReadingTimeRewritePrompt(analysis: ReadingTimeAnalysis) {
  const spec = READING_PROFILES[analysis.profile];
  const base = `
当前正文约 ${analysis.minutes} 分钟（${analysis.charCount} 字，${analysis.statusLabel}）。
类型：${analysis.profileLabel}。
${analysis.guidance}`;

  if (analysis.status === "too_long" || analysis.status === "long") {
    return `${base}

润色时的压缩策略（不可牺牲事实）：
- 合并重复判断与过渡句，删空洞套话和报告腔。
- 保留全部数字、产品名、测试步骤与结论；不得删章节。
- 若缺少文首快读结论，在正文最前增加 3–5 行「先给结论」段落（不删原文）。
- 目标：向 ${spec.idealMaxMinutes} 分钟内靠拢，至少压缩 8–15% 冗余字数。`.trim();
  }

  if (analysis.status === "too_short") {
    return `${base}

润色策略：
- 优先提升可读性与节奏，不强行注水扩写。
- 仅在关键结论处补 1 句具体场景或例子（不虚构数据）。`.trim();
  }

  return `${base}

润色策略：
- 时长已在理想区间，重点降低 AI 味、优化节奏与段落呼吸感。
- 不增删核心信息与数据，不改变章节顺序。`.trim();
}

export function formatReadingTimeBadge(analysis: ReadingTimeAnalysis) {
  return `约 ${analysis.minutes} 分钟 · ${analysis.statusLabel}`;
}
