/** 改稿时注入 LLM 的补充信息（事实更新、测试条件澄清等） */

export function buildSupplementaryNotesPrompt(notes: string | undefined) {
  const trimmed = notes?.trim();
  if (!trimmed) return "";
  return `
作者补充信息（改稿时必须融入正文，替换文中过时/匿名表述；不得与下列事实矛盾）：
${trimmed}
`.trim();
}

/** Parvis 盲测稿默认补充（模型已实名、测试条件澄清） */
export const PARVIS_BLINDTEST_SUPPLEMENTARY_NOTES = `测试对象实名更新（文中「匿名」「Cola-A/B」等表述需按下列名称替换）：
- 原 Cola-A → August（Qwen 3.8 Flash），Cola 内该模型已不再匿名
- 原 Cola-ox / 牛来 → GLM 5.3 Flash（智谱），已不再匿名
- Parvis：测试时选用 Auto 模式
- WorkBuddy：测试时选用 Auto 模式
- Codex：使用 GPT 5.6 Sol（非裸 Codex）

测试条件补充：
- 本轮 Codex 并非裸模型能力，而是做本项目时无意间将 Urban Design Skill 加载到了全局环境，因而自动使用了 haidian 技能库：https://github.com/open-city-ai/haidian
- 文中凡写「Codex + Skill」处，需明确：优势部分来自该技能与工作流，不完全代表裸 Codex 默认表现
- 下文综合分数来自《北港片区多Agent盲测综合对比报告》，比较的是「开放式 T25 总规划师盲测」下的系统配置表现，不是裸模型排行榜；Parvis 第一轮 25 项专项高分不在该排名内

开放式盲测综合评估（报告整理，非官方评分）：
- Codex + Skill：91/100
- August（Cola-A）：90/100
- GLM 5.3 Flash（Cola-B）：75/100
- WorkBuddy：67/100
- Parvis：38/100

Parvis 开放式盲测关键事实（报告）：
- 过程里建了 9 阶段任务树，但未稳定落实为 GIS 重算链
- 最终报告仍写「约 238ha，GIS 复核待做」（Benchmark 为 240ha）
- 方案比选仍沿用设计单位汇总口径（如 315 万㎡ / 61,800 人），未全量从 GIS 重算
- 将 B/C 等判为整体「合规」时，未完整吸收洪涝、河道、生态、高压、燃气、历史等空间硬冲突

Codex + Skill 关键结果（报告）：
- B+ 优化情景：约 388.74 万㎡、60,000 人、绿地 29.38%、公服 8.13%、道路 19.33%
- 建立 CK-01–CK-10 校核矩阵与 HD-01–HD-05 人工决策接口

August / GLM / WorkBuddy 关键结果（报告）：
- August：D1 生态优先 + D2 容量优先两情景；住宅口径约 51.22㎡/人来自反算；缺资料不编数
- GLM：推荐方案 R「一脊两带一核五片」；为凑 6 万人曾引入 45㎡/人等假设，须标注为情景
- WorkBuddy：R1 约 249 万㎡ / 3.65 万人；结论建议 5.0–5.3 万人但与 R1 方案本身未闭环

可融入结尾的产品判断：
- 不宜写成裸模型排行榜；专业 Skill、真值管理、校核闭环与模型同样重要
- 更合理的分工：Codex 主规划闭环 / August 技术审计 / GLM 方案创意 / WorkBuddy 合规红队 / Parvis 资料与 QA 工作台`.trim();
