# 公众号主题排版 Implementation Plan

> 执行方式：本会话内逐项实现与验证；用户已批准上一轮的第一版范围。

**Goal:** 三套自主实现的公众号主题、章节编号、重点样式、手机预览、HTML 检查与导出、逐稿保存排版设置。

**Architecture:** 沿用 remark MDAST → 内联 HTML → 预览 / 剪贴板 / 下载链路。排版设置进入 ContentItem 和现有草稿自动保存链路；Word 保持独立渲染。纯排版不调用 AI，不改变 Markdown 原文。

**Tech Stack:** TypeScript、React 19、Next.js 16、现有 unified/remark、node:test。

## Constraints

- 保留当前工作区已有改动，不引入依赖，不复制第三方模板或校验源码。
- 新主题标识：tech-minimal / tutorial-cards / editorial；保留 tech-eval / general。
- 原始 HTML 只作为文字显示（允许无属性 br 换行），URL 限定安全协议；校验器检查输出，不充当通用 sanitizer。
- 不新增引言文案、署名或互动引导；只渲染原文引用和已有加粗。
- Word 不继承 HTML 主题；界面明示。真实公众号粘贴兼容性需另外验证。

## Tasks

- [x] 1. 扩展 `src/lib/markdown/wechat-theme.ts` 与 `wechat-html.ts`。
  - `WechatLayoutSettings`：`theme: WechatThemeId; numberSections: boolean; emphasize: boolean`。
  - `normalizeWechatLayout(value: unknown): WechatLayoutSettings` 兼容旧稿和未知值。
  - 渲染设置沿用 options，章节计数在每次渲染内创建；文本使用 leaf span；只对独立图片段落添加图注。
  - 先在 `wechat-theme.test.ts` / `wechat-html.test.ts` 添加编号开关、重点开关、图片图注、引用链接、原文保留、安全 URL 和嵌图失败测试，运行后实现。
- [x] 2. 新增 `wechat-html-validation.ts` / `.test.ts`，扩展 `wechat-publish.ts` / `.test.ts`。
  - `validateWechatHtml(fragment): { errors: string[]; warnings: string[] }` 检查输出标签、属性、CSS、leaf 和结构，渐变 / 表格提供提醒。
  - `buildWechatPublishHtml` 在边界校验；`buildWechatHtmlDocument` 复用片段并转义标题、封装 UTF-8 文档。
  - 复制和下载内嵌可解析图片，无法嵌入时显式报错，避免静默缺图。
- [x] 3. 在 `src/types/domain.ts`、`src/lib/store/hydrate.ts`、`use-wechat-draft.ts` 接入 `wechatLayout`。
  - 默认技术测评、不开编号、保留重点；新主题选择时开启编号。
  - 加入加载、比较、自动保存、显式保存、重置；hydrate 测试验证旧稿回退和不同稿件设置独立。
- [x] 4. 更新 `wechat-publish-panel.tsx` 和 `wechat-draft-panel.tsx`，新增 `wechat-theme-picker.tsx`。
  - 可视主题选择、编号 / 重点开关、375px 手机与宽屏预览、HTML 下载入口。
  - 防止过期异步渲染覆盖新稿预览；检查失败时不显示旧预览。
  - 通过现有 draft 回调保存排版设置，沿用发布检查。
- [x] 5. 验证：相关 node:test → TypeScript → 改动文件 ESLint → 独立浏览器验证切换稿件 / 刷新 / 导出 / 复制 / 手机布局。

## Commands

```powershell
node --import tsx --test src/lib/markdown/wechat-theme.test.ts src/lib/markdown/wechat-html.test.ts src/lib/markdown/wechat-html-validation.test.ts src/lib/markdown/wechat-publish.test.ts src/lib/store/hydrate.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

## Baseline

2026-10-28：现有四个相关测试文件共 19 项通过。工作分支 `codex/wechat-typesetting`；基于现有未提交改动，不创建丢失这些改动的独立 checkout。

## Verification results

- `node --import tsx --test 'src/lib/markdown/*.test.ts' src/lib/export-wechat-docx.test.ts src/lib/store/hydrate.test.ts src/lib/seed/restore.test.ts`：54 项通过。
- `node node_modules/typescript/bin/tsc --noEmit`：通过。
- 对本次 16 个 TypeScript/TSX 文件执行 ESLint：通过。
- `git diff --check`：通过，仅 Git 的 LF/CRLF 提示。
- Playwright 独立浏览器会话：逐稿主题、编号/重点开关、刷新恢复、Markdown 保持原样、375px/窄屏预览、HTML 下载、包含图片的富文本剪贴板均通过。
- 浏览器回归：本地拦截 AI 请求并延迟返回，润色期间切换排版，完成后保留新设置。没有调用真实 AI 服务。
- 两条种子恢复路径原先会丢掉新设置；`src/lib/seed/restore.ts` 已增加两处字段保留，回归覆盖首次刷新和短稿恢复。
- 重复引用定义采用首个定义；回归覆盖正文前后链接一致性。
- 只读复核提出的两项 P2 均修复并复核通过。
- 未运行生产构建；本次验证使用开发页面、类型检查和定向回归。未登录微信公众号进行实际粘贴验证。

## Changed files

- `src/lib/markdown/wechat-theme.ts`、`wechat-theme.test.ts`
- `src/lib/markdown/wechat-html.ts`、`wechat-html.test.ts`
- `src/lib/markdown/wechat-html-validation.ts`、`wechat-html-validation.test.ts`（新增）
- `src/lib/markdown/wechat-publish.ts`、`wechat-publish.test.ts`
- `src/components/shared/wechat-publish-panel.tsx`
- `src/components/shared/wechat-theme-picker.tsx`（新增）
- `src/app/(workspace)/content/components/wechat-draft-panel.tsx`
- `src/app/(workspace)/content/hooks/use-wechat-draft.ts`
- `src/types/domain.ts`
- `src/lib/store/hydrate.ts`、`hydrate.test.ts`
- `src/lib/seed/restore.ts`

浏览器复测脚本、截图和下载样例位于本地忽略目录 `output/playwright/`。
