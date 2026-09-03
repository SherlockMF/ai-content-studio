# 小红书图文转换设计

## 目标

在现有公众号稿件页中增加“一键转小红书”。系统以当前公众号长文为事实和观点来源，一次生成两套可切换的小红书文案，以及一组可交给 GPT 生图的图片提示词。转换结果保存为独立稿件，由用户复制或导出后手动发布。

首版不生成图片，不登录小红书，也不调用自动发布接口。小红书开放平台当前公开文档仍将 `write_notes` 标为规划中，因此手动发布也是当前稳定的产品边界：[授权范围（Scope）](https://openaccount.xiaohongshu.com/docs/scope)。

## 用户流程

1. 用户在已有公众号稿件中点击“一键转小红书”。
2. 页面将当前编辑区内容、账号人设和补充资料发送给 `/api/ai/xiaohongshu`。
3. API 一次返回专业轻表达版、强氛围版和共享的图片规划。
4. 成功后，客户端创建或更新一篇关联的小红书稿件，并自动切换到该稿件。
5. 用户可切换、编辑和保存两套文案，逐张复制图片提示词，并在发布区完成检查。
6. 用户复制文案与提示词，使用 GPT 生成图片，再到小红书手动发布。

若同一公众号稿件已经有关联的小红书稿件，再次转换更新该关联稿件，不新增重复记录。覆盖前显示明确确认；旧内容完整写入版本历史。

## 数据模型

新增小红书专属类型：

```ts
export type XiaohongshuTone = "professional" | "social";

export interface XiaohongshuVariant {
  title: string;
  body: string;
  cta: string;
  hashtags: string[];
}

export interface XiaohongshuImagePrompt {
  index: number;
  role: "cover" | "content" | "ending";
  objective: string;
  overlayText: string;
  composition: string;
  prompt: string;
}

export interface XiaohongshuDraftData {
  sourceContentId: string;
  activeTone: XiaohongshuTone;
  variants: Record<XiaohongshuTone, XiaohongshuVariant>;
  visualDirection: string;
  imagePlan: XiaohongshuImagePrompt[];
}
```

`ContentItem` 增加可选的 `xiaohongshu?: XiaohongshuDraftData`。一篇关联稿件包含两种风格，状态和排期只维护一次。

为了兼容现有稿件列表、日历和状态逻辑，`ContentItem.title`、`body`、`cta` 始终同步当前 `activeTone` 的内容；`coverCopy` 同步封面图的 `overlayText`。切换风格和保存时均执行同一同步函数，避免通用字段与平台数据发生漂移。

`ContentVersion` 同样增加可选的 `xiaohongshu` 快照，使“重新转换”和手工编辑后能够恢复两套文案与整组图片提示词，而不是只能恢复当前展示的一版。

旧数据迁移不改写公众号稿件。缺少 `xiaohongshu` 的历史 `xiaohongshu` 类型记录按普通稿件读取，并在首次重新转换后补齐新结构。

## AI 接口与生成规则

恢复现有 `/api/ai/xiaohongshu` POST 路由。请求包含：

- 来源稿件 ID、标题、摘要、正文、结尾和补充资料。
- 当前账号的 `PublishVoice`。
- 当前 LLM 设置。

响应由 Zod schema 约束，必须一次返回：

```ts
{
  variants: {
    professional: { title, body, cta, hashtags },
    social: { title, body, cta, hashtags }
  },
  visualDirection,
  imagePlan: [{ index, role, objective, overlayText, composition, prompt }]
}
```

生成器以公众号正文为唯一事实基线，并应用以下共同规则：

- 保留原文的事实、数字、实体、案例和核心观点。
- 不虚构“亲测”“用了若干天”“结果提升若干倍”等第一人称经历。
- 不添加原文不能支持的结论、承诺和产品效果。
- 使用短段落和移动端可读结构，不照搬公众号长文的小标题密度。
- 每版输出 5～8 个与正文直接相关的话题，禁止堆砌无关热门标签。
- 避免标题党、求赞求关注、站外引流和夸张承诺。相关约束参考小红书公开的[主题规范](https://top.xiaohongshu.com/fe/toph5/rules/subject)。

两种风格必须有可感知差异：

- `professional`：约 600～900 字，保留专业词汇和论证链，使用清晰小标题、短段落和少量 emoji。
- `social`：约 400～700 字，加强开场钩子、节奏、情绪与互动感，可增加 emoji，但仍受事实基线约束。

图片规划规则：

- 根据内容复杂度自动规划 5～8 张，默认 3:4、1080×1440。
- 第 1 张必须为封面；中间每张只表达一个主要观点；最后一张负责总结或互动引导。
- `visualDirection` 定义全组共同的颜色、字体气质、留白与视觉元素，每条提示词都复用该方向。
- 每张给出画面职责、精确图中文字、构图要求和完整 GPT 生图提示词。
- 提示词注明中文文字的层级、安全边距和可读性要求，不加入来源稿件未出现的品牌或人物。

`imagePlan` 是两种文案共享的内容图组，围绕原文核心观点规划。用户可单独重新规划图片提示词，不覆盖两套文案。

## 编辑器设计

稿件页顶部增加 `公众号｜小红书` 平台切换。平台切换作用于当前选题：

- 有对应稿件时载入该稿件。
- 没有小红书稿件时显示来源说明和“一键转小红书”。
- 从公众号发起转换成功后自动切换至新稿件。

小红书编辑区包含：

1. 来源公众号稿件链接与稿件状态。
2. `专业轻表达`、`强氛围版` 两个风格页签。
3. 当前版本的标题、正文、互动收尾和话题编辑区。
4. 接近手机内容宽度的笔记预览。
5. 图片提示词卡片列表。
6. 小红书发布检查与复制、导出操作。

图片提示词卡片按封面、图 2、图 3依次显示 `objective`、`overlayText`、`composition` 和 `prompt`，支持单张复制、复制全部及“重新规划图片”。

发布区提供：

- `复制完整笔记`
- `复制标题`
- `复制正文和话题`
- `复制全部生图提示词`
- `导出小红书发布包（Markdown）`

发布包包含来源稿件信息、当前选中的完整笔记、另一风格备选稿、视觉方向，以及按编号排列的全部图片提示词。文件名使用清理后的稿件标题，并带 `xiaohongshu` 标识。

## 保存、版本与状态

小红书稿件沿用现有 `ContentStatus`、排期和本地存储机制。保存任一版本时：

1. 先写入当前版本编辑值。
2. 更新 `activeTone`。
3. 同步通用 `title`、`body`、`cta` 和 `coverCopy`。
4. 写入包含完整 `xiaohongshu` 数据的 `ContentVersion`。

重新转换全文会覆盖两版文案和图片规划，因此必须在执行前确认，并在覆盖前写入版本快照。单独重新规划图片只更新 `visualDirection` 与 `imagePlan`。

小红书稿件的发布检查至少包含：

- 当前标题、正文和互动收尾非空。
- 话题数量为 5～8 个，且没有空话题。
- 图片规划数量为 5～8，首张为 `cover`，末张为 `ending`。
- 每张图的图中文字、构图和提示词完整。
- 最近一次小红书质检不存在必须修改的问题。

检查未通过时仍允许保存和复制单个字段，但禁用“复制完整笔记”和标记为“待发布”。

## 质检

现有质检入口根据当前平台选择 reviewer。小红书 reviewer 检查：

- 与来源公众号正文的事实一致性。
- 是否虚构个人经历、使用结果或数据。
- 标题与正文是否匹配，是否存在夸张承诺。
- 移动端可读性、段落节奏和风格差异。
- 话题与正文相关性。
- 图片规划是否完整、单图职责是否清晰、整组视觉是否一致。

质检结果继续保存为 `ContentReview`，关联小红书稿件 ID，不与来源公众号稿件的质检记录混用。

## 异常处理

- 来源正文为空时在客户端阻止转换，并提示先填写正文。
- 请求失败、返回非成功状态或 schema 校验失败时，不创建或覆盖任何稿件。
- 已有关联稿件时，API 成功返回后再原子地替换两版数据；失败时保留旧内容。
- 剪贴板权限失败时显示错误，不误报复制成功。
- 导出失败时保留编辑内容，并显示具体可重试提示。
- 找不到来源公众号稿件时，小红书稿件仍可编辑和导出，但来源区域显示“来源稿件不可用”。

## 代码边界

预期新增或修改的边界如下：

- `src/types/domain.ts`：小红书数据类型及版本快照。
- `src/lib/ai/schemas/index.ts`：结构化生成 schema。
- `src/lib/ai/generators/index.ts`：公众号到小红书的转换生成器。
- `src/app/api/ai/xiaohongshu/route.ts`：请求解析、生成和错误响应。
- `src/lib/xiaohongshu/`：发布检查、字段同步、剪贴板和 Markdown 导出等纯函数。
- `src/components/shared/xiaohongshu-publish-panel.tsx`：预览、检查、复制与导出。
- `src/app/(workspace)/content/content-editor.tsx`：平台切换、转换入口和小红书编辑状态。
- 现有 store 迁移：保证旧 localStorage 数据可读。

不引入新的运行时依赖，不改动公众号生成和发布格式，不增加自动发布或图片生成能力。

## 验证与验收

最小自动验证包括：

- 生成 schema 接受完整双版本与 5～8 张图片规划，拒绝缺字段和越界数量。
- 字段同步函数在切换风格和保存后正确更新通用字段。
- 发布检查覆盖空字段、话题数量、图片顺序、图片字段和质检阻断。
- Markdown 发布包同时包含当前版本、备选版本和全部图片提示词。
- API 成功返回结构化数据，模型失败或无效输出时不返回伪成功。
- 编辑器可从公众号生成关联稿件、切换两种风格、保存各自修改，并在重复转换前确认。
- 历史数据缺少 `xiaohongshu` 时仍能正常载入。

实现完成后运行相关测试、ESLint 和生产构建。人工验收使用一篇包含数字与案例的公众号稿件，确认两版文案风格明显不同、事实未改变、生成 5～8 张连续图片提示词，并能复制与导出完整发布包。
