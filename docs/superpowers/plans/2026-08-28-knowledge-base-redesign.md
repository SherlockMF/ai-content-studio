# Knowledge Base Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将短文本素材库升级为支持笔记文件上传、检索、预览和生成前确认引用的本地优先知识库。

**Architecture:** 文档元数据、正文和片段由独立 IndexedDB repository 管理，页面通过 focused hooks/components 使用；文件解析复用并扩展现有 `/api/documents/extract`。AI 路由接受独立的 `knowledgeReferences`，只把用户确认的来源片段加入 Prompt，保持旧 `materials` 接口兼容。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、IndexedDB、Supabase migration、现有 shadcn/Base UI 组件。

## Global Constraints

- 保留 `/materials` 路由以及现有 `MaterialItem` 数据。
- 单文件上限 10 MB；支持 `.md`、`.markdown`、`.txt`、`.docx`、`.pdf`，拒绝旧 `.doc`。
- 大文本不得写入当前 App Store/localStorage。
- 未配置 Supabase 时本地知识库必须完整可用。
- AI 请求只发送已确认片段，且包含来源标题。

---

### Task 1: 知识库领域模型与纯函数

**Files:**
- Modify: `src/types/domain.ts`
- Create: `src/lib/knowledge/chunk-document.ts`
- Create: `src/lib/knowledge/search.ts`

**Interfaces:**
- Produces: `KnowledgeDocument`, `KnowledgeChunk`, `KnowledgeReference`, `chunkKnowledgeText(text, documentId)`, `rankKnowledgeChunks(query, documents, chunks, limit)`。

- [ ] 定义文档、分段、引用和解析状态类型。
- [ ] 实现按自然段合并、长段硬切的稳定分段函数。
- [ ] 实现标题、标签、正文关键词加权检索以及同文档结果去重。
- [ ] 运行 `npx tsc --noEmit`，预期无类型错误。

### Task 2: IndexedDB repository 与上传解析

**Files:**
- Create: `src/lib/knowledge/repository.ts`
- Modify: `src/lib/extract-document-text.ts`
- Modify: `src/app/api/documents/extract/route.ts`
- Modify: `package.json`
- Modify: lockfile used by npm

**Interfaces:**
- Consumes: Task 1 的知识库类型与分段函数。
- Produces: `listKnowledgeDocuments`, `saveKnowledgeDocument`, `deleteKnowledgeDocument`, `setKnowledgeDocumentEnabled`, `searchKnowledgeReferences`, `extractKnowledgeFile`。

- [ ] 实现版本化 IndexedDB schema，分别存储 documents 和 chunks。
- [ ] 保存文档时以一个 transaction 同步替换所属 chunks，删除时级联删除 chunks。
- [ ] 增加 10 MB 校验和一致的 accept 列表。
- [ ] 扩展服务端解析以支持 PDF，并保留 DOCX 解析。
- [ ] 运行 TypeScript 检查，预期无类型错误。

### Task 3: 知识库页面全面改版

**Files:**
- Rewrite: `src/app/(workspace)/materials/page.tsx`
- Modify: `src/lib/store/app-store.tsx`
- Modify: `src/components/shared/app-shell.tsx`

**Interfaces:**
- Consumes: Task 2 repository API、现有 `useAppStore()`。
- Produces: 可上传、搜索、筛选、预览、启停和删除的资料文档页，以及完整 CRUD 的知识条目页。

- [ ] 为 App Store 增加 `deleteMaterial`。
- [ ] 将导航文案改为“知识库”。
- [ ] 实现双 Tab 页面、批量文件选择、拖放上传、解析进度和错误反馈。
- [ ] 实现文档搜索、状态过滤、预览、启停和删除。
- [ ] 实现知识条目新增、编辑、筛选、启停和删除。
- [ ] 运行 ESLint，预期改动文件无错误。

### Task 4: 生成前知识引用选择器

**Files:**
- Create: `src/components/shared/knowledge-reference-picker.tsx`
- Modify: `src/components/shared/topic-workbench.tsx`
- Modify: `src/app/(workspace)/content/content-editor.tsx`

**Interfaces:**
- Consumes: `searchKnowledgeReferences(query, limit)`。
- Produces: `KnowledgeReferencePicker({ query, value, onChange })`，值为用户确认的 `KnowledgeReference[]`。

- [ ] 实现 query 改变后的自动推荐，并避免覆盖用户已手动调整的结果。
- [ ] 实现来源片段列表、勾选增删、重新推荐和空状态。
- [ ] 在热点方向和公众号出稿区域接入选择器。
- [ ] 将确认引用作为 `knowledgeReferences` 随生成请求发送。
- [ ] 运行 ESLint 和 TypeScript 检查。

### Task 5: AI 路由与 Prompt 来源注入

**Files:**
- Modify: `src/app/api/ai/research-directions/route.ts`
- Modify: `src/app/api/ai/topics/route.ts`
- Modify: `src/app/api/ai/wechat/route.ts`
- Modify: `src/lib/ai/prompts/index.ts`

**Interfaces:**
- Consumes: `KnowledgeReference[]` JSON payload。
- Produces: 仅包含已确认引用的来源标记 Prompt，同时保留旧素材。

- [ ] 校验并限制引用数量、单段长度和总字符数。
- [ ] 格式化为 `[知识库来源：标题]` 后加入现有 context materials。
- [ ] 保证没有 `knowledgeReferences` 的旧请求输出路径不变。
- [ ] 运行 TypeScript 检查和相关 API 静态检查。

### Task 6: Supabase 结构与全量验证

**Files:**
- Create: `supabase/migrations/20260828_knowledge_documents.sql`

**Interfaces:**
- Produces: 可重复执行的 `knowledge_documents`、`knowledge_chunks` 表、索引和级联关系。

- [ ] 编写 migration，字段与 TypeScript 模型保持一致。
- [ ] 检查计划与实现中不存在 placeholder 或未接线接口。
- [ ] 运行 `npm run lint`，预期 exit code 0。
- [ ] 运行 `npx tsc --noEmit`，预期 exit code 0。
- [ ] 运行 `npm run build`，预期 exit code 0。
- [ ] 手工启动页面，验证上传、刷新持久化、检索、引用增删和生成请求 payload。
