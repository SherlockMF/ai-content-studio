/** 是否为「测评型」草稿（含真实测试过程、数据、对比） */
export function isEvaluationDraft(input: { topicId: string; body: string }) {
  if (input.topicId === "topic_gis") return true;

  const text = input.body.trim();
  if (!text) return false;

  const evaluationSignals =
    /测评|盲测|专项测试|结构化测试|两轮测试|第一轮|第二轮|测试里|测试完|重新计算|指标重算|Parvis|QA\b|对照组|实验组/i;
  const dataSignals = /约\s*[\d,.]+%|[\d,]+\s*人|公顷|绿地率|容积率|FAR/i;

  const signalHits = [evaluationSignals.test(text), dataSignals.test(text)].filter(Boolean).length;
  return signalHits >= 2;
}
