# 公众号质检：表格 / 悬空引用 / 专名可读

**日期**：2026-09-22  
**状态**：已确认，已实现

## 背景

发布预览中暴露过：Markdown 表未成表（露出 `| --- |`）、插图后孤立「来源」锚文本、Stripe 等外文专名无白话解释。现有 AI 质检只审稿件文本五维，不覆盖版面残留与专名首次可读性；发布检查也不拦这些项。

## 目标

在质检与发布前检查中纳入**可规则化检出**的问题，并加强 AI 质检对专名/引用呈现的软约束。不假装验证微信后台粘贴效果。

## 范围

- 公众号：AI 质检合并规则 issues；发布检查增加对应项
- 小红书本轮不改
- 不自动改稿；定点修改仍走现有 revise

## 确定性规则

新增纯函数（如 `collectWechatEditorialFlags(body)`），输出与质检 issue 兼容的列表（`dimension` / `severity` / `suggestion`）。

| id / dimension 线索 | 触发条件 | severity |
| --- | --- | --- |
| `orphan-source-link` | 独立成段成行的 `[来源](url)`，或图后仅剩「来源」锚文本行 | high |
| `broken-markdown-table` | 出现表格分隔行特征，但正文无法被 GFM 解析为 `table` 节点（如换行被压扁） | high |
| `table-preview-reminder` | 正文存在至少一个可解析的 Markdown 表 | medium（文案：复制/预览时核对是否成表，勿露出 `\|` 源码） |

内联且紧跟论述句的 `[来源](url)`（同一段落内、非独占一行）**不**报 `orphan-source-link`。

## 接入

1. **AI 质检**：`reviewContent` 取得模型结果后，将 flags 并入 `issues`；按 suggestion/dimension 去重，避免与模型重复条。
2. **发布检查**：`buildWechatPublishChecks` 增加三项；`orphan-source-link` 与 `broken-markdown-table` 为 `ok: false`；`table-preview-reminder` 为提示项（`ok: true` 或非阻断，但 label/hint 可见——采用 `ok: true` + hint，避免误挡复制，同时发前能看见）。

## AI 提示词

在公众号 `reviewContent` 检查维度中追加：

- **专名可读**：外文产品/公司名首次出现时，上下文是否足以让目标受众理解；否则 medium/high，建议补白话或改写。
- **引用呈现**：禁止仅用「来源」作链接文案；应写入句子或可读出处名；插图前后勿留孤立引用行。

保持现有证据边界：不因 `/article-assets/`、未验证导出而误报 high。

## 非目标

- 不验证微信后台真实粘贴/渲染
- 不扫描 `data:image`、不因本地资源路径判缺图
- 不扩展小红书质检

## 验证

- 单测：悬空来源、损坏表、正常表提醒、正常段内引用不误报
- `reviewContent` 合并与去重；`buildWechatPublishChecks` 新项断言
- 现有 Word 交付边界相关测试继续通过
