import { ContentSection } from "@/types/domain";

export interface AiTopicMatch {
  section: ContentSection;
  terms: string[];
}

export const AI_TOPIC_MATCHES: AiTopicMatch[] = [
  {
    section: "AI 通识",
    terms: [
      "ai",
      "人工智能",
      "大模型",
      "llm",
      "gpt",
      "chatgpt",
      "claude",
      "deepseek",
      "openai",
      "anthropic",
      "生成式",
      "aigc",
      "多模态",
    ],
  },
  {
    section: "工具与工作流",
    terms: [
      "agent",
      "智能体",
      "copilot",
      "cursor",
      "编程",
      "代码",
      "自动化",
      "工作流",
      "提效",
      "插件",
      "mcp",
      "rag",
      "prompt",
    ],
  },
  {
    section: "组织 AI 进化",
    terms: [
      "企业",
      "组织",
      "团队",
      "管理",
      "转型",
      "落地",
      "数字化",
      "saas",
      "办公",
      "协作",
      "人力",
      "培训",
    ],
  },
  {
    section: "行业观察",
    terms: [
      "融资",
      "上市",
      "监管",
      "政策",
      "创业",
      "芯片",
      "算力",
      "机器人",
      "自动驾驶",
      "竞争",
      "市场",
      "趋势",
    ],
  },
];

export function normalizeHotspotText(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

export function matchAiHotspotText(text: string) {
  const normalized = normalizeHotspotText(text);
  const matchedTerms: string[] = [];
  const sections = new Set<ContentSection>();

  for (const group of AI_TOPIC_MATCHES) {
    for (const term of group.terms) {
      if (normalized.includes(normalizeHotspotText(term))) {
        matchedTerms.push(term);
        sections.add(group.section);
      }
    }
  }

  const uniqueTerms = [...new Set(matchedTerms)];
  const relevance: "强" | "中" | "弱" =
    uniqueTerms.length >= 3 ? "强" : uniqueTerms.length >= 1 ? "中" : "弱";

  return {
    relevance,
    matchedTerms: uniqueTerms,
    sections: [...sections],
  };
}
