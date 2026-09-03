# Xiaohongshu Article Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert an existing WeChat article into one saved Xiaohongshu draft containing two editable tones and a shared 5–8 image prompt plan for manual publishing.

**Architecture:** Keep the current WeChat editor intact and add a sibling `xiaohongshu` content item linked by `sourceContentId`. Put schema-validated generation behind the existing Route Handler, keep state normalization and publishing output in pure modules, and render Xiaohongshu editing in a focused client component selected from the existing content page.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript, Zod, Tailwind CSS, shadcn components, Sonner, Node test runner loaded through `tsx`.

## Global Constraints

- Preserve the current uncommitted workspace changes; inspect the diff before editing and never reset or overwrite unrelated hunks.
- Read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and `05-server-and-client-components.md` before editing Route Handlers or client components.
- Do not add runtime dependencies or automatic Xiaohongshu publishing.
- Generate text and GPT image prompts only; do not generate image files.
- One Xiaohongshu content item stores both `professional` and `social` variants and one shared image plan.
- The image plan contains 5–8 items, starts with `cover`, ends with `ending`, and targets 3:4 / 1080×1440 images.
- Failed generation or invalid structured output must leave the existing draft unchanged.
- Existing WeChat generation, editing, export, scheduling, and publishing behavior must continue to work.
- Before every commit, inspect `git diff --cached`; do not commit pre-existing user changes from overlapping files.

---

## File Map

- `src/types/domain.ts`: platform data and version snapshot contracts.
- `src/lib/ai/schemas/index.ts`: strict generation result schema.
- `src/lib/xiaohongshu/content.ts`: create, update, and normalize linked drafts.
- `src/lib/xiaohongshu/publish.ts`: publish checks and plain-text/Markdown builders.
- `src/lib/ai/xiaohongshu-prompt.ts`: conversion and review prompt construction.
- `src/lib/ai/generators/index.ts`: provider call for structured conversion output.
- `src/app/api/ai/xiaohongshu/handler.ts`: testable request handling with injected generator.
- `src/app/api/ai/xiaohongshu/route.ts`: Next.js HTTP adapter.
- `src/lib/ai/reviewers/index.ts` and `src/app/api/ai/review/route.ts`: platform-specific review.
- `src/components/shared/xiaohongshu-editor.tsx`: dual-tone editing and conversion states.
- `src/components/shared/xiaohongshu-publish-panel.tsx`: preview, checks, clipboard, and export.
- `src/app/(workspace)/content/content-editor.tsx`: platform selection and conversion entry.
- `src/lib/store/app-store.tsx`: safe hydration of new optional fields.
- `src/lib/xiaohongshu/*.test.ts` and `src/app/api/ai/xiaohongshu/handler.test.ts`: focused automated coverage.

---

### Task 1: Add the Xiaohongshu domain, schema, and draft normalization

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/types/domain.ts:1-240`
- Modify: `src/lib/ai/schemas/index.ts:35-60`
- Create: `src/lib/xiaohongshu/content.ts`
- Create: `src/lib/xiaohongshu/test-fixtures.ts`
- Create: `src/lib/xiaohongshu/content.test.ts`

**Interfaces:**
- Produces: `XiaohongshuTone`, `XiaohongshuVariant`, `XiaohongshuImagePrompt`, `XiaohongshuGenerationResult`, and `XiaohongshuDraftData`.
- Produces: `xiaohongshuOutputSchema`.
- Produces: `createXiaohongshuContent()`, `saveXiaohongshuVariant()`, and `normalizeXiaohongshuContent()`.

- [ ] **Step 1: Add the TypeScript test loader and test script**

Run:

```powershell
npm install --save-dev tsx
```

Set the script in `package.json` to:

```json
{
  "scripts": {
    "test": "tsx --test src/**/*.test.ts"
  }
}
```

Expected: `tsx` appears only in `devDependencies`; existing dependency ranges and scripts remain unchanged.

- [ ] **Step 2: Add complete shared test fixtures and failing normalization tests**

Create `src/lib/xiaohongshu/test-fixtures.ts`:

```ts
import type { ContentItem, XiaohongshuGenerationResult } from "@/types/domain";

export const now = "2026-09-03T01:00:00.000Z";

export const sourceItem: ContentItem = {
  id: "wechat-1",
  workspaceId: "ws_demo",
  topicId: "topic-1",
  platform: "wechat",
  source: "imported",
  title: "公众号标题",
  body: "公众号正文包含 25 项任务。",
  status: "编辑中",
  createdAt: "2026-09-03T00:00:00.000Z",
  updatedAt: "2026-09-03T00:00:00.000Z",
};

export const validResult: XiaohongshuGenerationResult = {
  variants: {
    professional: {
      title: "专业版标题",
      body: "专业版正文",
      cta: "你会怎么做？",
      hashtags: ["AI工作流", "组织进化", "职场成长", "效率工具", "知识管理"],
    },
    social: {
      title: "这套方法终于讲清了✨",
      body: "氛围版正文",
      cta: "评论区聊聊你的做法～",
      hashtags: ["AI工作流", "打工人", "效率提升", "职场干货", "成长思维"],
    },
  },
  visualDirection: "克制的编辑感知识卡片，米白底、珊瑚红点缀",
  imagePlan: [
    { index: 1, role: "cover", objective: "建立主题", overlayText: "AI 不是工具升级", composition: "标题居中", prompt: "3:4 竖版知识卡片封面" },
    { index: 2, role: "content", objective: "解释变化", overlayText: "工作方式正在改变", composition: "左右对照", prompt: "3:4 竖版对照信息图" },
    { index: 3, role: "content", objective: "展示步骤", overlayText: "三个落地步骤", composition: "纵向流程", prompt: "3:4 竖版流程信息图" },
    { index: 4, role: "content", objective: "给出案例", overlayText: "从任务到闭环", composition: "案例卡片", prompt: "3:4 竖版案例卡片" },
    { index: 5, role: "ending", objective: "总结互动", overlayText: "你准备先改哪一步？", composition: "大字总结", prompt: "3:4 竖版收尾卡片" },
  ],
};
```

Create `src/lib/xiaohongshu/content.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  createXiaohongshuContent,
  normalizeXiaohongshuContent,
  saveXiaohongshuVariant,
} from "./content";
import { xiaohongshuOutputSchema } from "@/lib/ai/schemas";
import { now, sourceItem, validResult } from "./test-fixtures";

test("accepts a complete result and rejects invalid image order", () => {
  assert.equal(xiaohongshuOutputSchema.safeParse(validResult).success, true);
  const invalid = {
    ...validResult,
    imagePlan: validResult.imagePlan.map((item, index) =>
      index === 0 ? { ...item, role: "content" as const } : item
    ),
  };
  assert.equal(xiaohongshuOutputSchema.safeParse(invalid).success, false);
});

test("creates one linked Xiaohongshu content item with professional active", () => {
  const item = createXiaohongshuContent({
    source: {
      ...sourceItem,
    },
    result: validResult,
    now,
  });
  assert.equal(item.platform, "xiaohongshu");
  assert.equal(item.xiaohongshu?.sourceContentId, "wechat-1");
  assert.equal(item.xiaohongshu?.activeTone, "professional");
  assert.equal(item.title, "专业版标题");
  assert.equal(item.coverCopy, "AI 不是工具升级");
});

test("saving social tone synchronizes common fields without changing professional", () => {
  const initial = createXiaohongshuContent({ source: sourceItem, result: validResult, now });
  const next = saveXiaohongshuVariant(initial, "social", {
    ...validResult.variants.social,
    title: "修改后的氛围版",
  }, now);
  assert.equal(next.title, "修改后的氛围版");
  assert.equal(next.body, "氛围版正文");
  assert.equal(next.xiaohongshu?.variants.professional.title, "专业版标题");
});

test("legacy Xiaohongshu content without platform data remains readable", () => {
  const legacy = { ...sourceItem, id: "xhs-old", platform: "xiaohongshu" as const };
  assert.equal(normalizeXiaohongshuContent(legacy), legacy);
});
```

- [ ] **Step 3: Run the test and confirm it fails**

Run:

```powershell
npm test -- src/lib/xiaohongshu/content.test.ts
```

Expected: FAIL because `./content` and the Xiaohongshu domain fields do not exist.

- [ ] **Step 4: Add domain contracts and strict schema**

Add the five interfaces from the approved design to `src/types/domain.ts`, add `xiaohongshu?: XiaohongshuDraftData` to both `ContentItem` and `ContentVersion`, and define the generation result as:

```ts
export interface XiaohongshuGenerationResult {
  variants: Record<XiaohongshuTone, XiaohongshuVariant>;
  visualDirection: string;
  imagePlan: XiaohongshuImagePrompt[];
}
```

Add to `src/lib/ai/schemas/index.ts`:

```ts
const xiaohongshuVariantSchema = z.object({
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  cta: z.string().trim().min(1),
  hashtags: z.array(z.string().trim().min(1)).min(5).max(8),
});

export const xiaohongshuOutputSchema = z.object({
  variants: z.object({
    professional: xiaohongshuVariantSchema,
    social: xiaohongshuVariantSchema,
  }),
  visualDirection: z.string().trim().min(1),
  imagePlan: z.array(z.object({
    index: z.number().int().positive(),
    role: z.enum(["cover", "content", "ending"]),
    objective: z.string().trim().min(1),
    overlayText: z.string().trim().min(1),
    composition: z.string().trim().min(1),
    prompt: z.string().trim().min(1),
  })).min(5).max(8).superRefine((items, context) => {
    if (items[0]?.role !== "cover") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "首张图片必须是 cover" });
    }
    if (items.at(-1)?.role !== "ending") {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "末张图片必须是 ending" });
    }
    if (items.some((item, index) => item.index !== index + 1)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "图片序号必须从 1 连续递增" });
    }
  }),
});
```

- [ ] **Step 5: Implement draft normalization**

In `src/lib/xiaohongshu/content.ts`, implement pure functions with these signatures:

```ts
export function createXiaohongshuContent(input: {
  source: ContentItem;
  result: XiaohongshuGenerationResult;
  now: string;
  existing?: ContentItem;
}): ContentItem;

export function saveXiaohongshuVariant(
  content: ContentItem,
  tone: XiaohongshuTone,
  variant: XiaohongshuVariant,
  now: string
): ContentItem;

export function normalizeXiaohongshuContent(content: ContentItem): ContentItem;
```

`createXiaohongshuContent()` must reuse `existing.id`, `createdAt`, `status`, `scheduledAt`, and `publishedAt` when updating an existing linked draft. It must otherwise create `xhs_${source.id}`, set `source: "ai"`, `status: "AI 草稿"`, and sync the professional variant into the common fields. `saveXiaohongshuVariant()` must immutably update only the selected variant, set `activeTone`, sync common fields, and preserve the shared image plan.

- [ ] **Step 6: Run focused tests and typecheck**

Run:

```powershell
npm test -- src/lib/xiaohongshu/content.test.ts
npx tsc --noEmit
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit isolated Task 1 changes**

Stage only Task 1 hunks. Because `package.json`, `package-lock.json`, and `src/types/domain.ts` already contain uncommitted edits, inspect each staged hunk and unstage any pre-existing change before committing.

```powershell
git diff --cached
git commit -m "feat: add Xiaohongshu draft model"
```

Expected: the commit contains the Xiaohongshu model, schema, pure helper, tests, and test loader only.

---

### Task 2: Restore the structured conversion API

**Files:**
- Create: `src/lib/ai/xiaohongshu-prompt.ts`
- Create: `src/lib/ai/xiaohongshu-prompt.test.ts`
- Modify: `src/lib/ai/generators/index.ts:20-210`
- Create: `src/app/api/ai/xiaohongshu/handler.ts`
- Rewrite: `src/app/api/ai/xiaohongshu/route.ts`
- Create: `src/app/api/ai/xiaohongshu/handler.test.ts`

**Interfaces:**
- Consumes: `XiaohongshuGenerationResult` and `xiaohongshuOutputSchema` from Task 1.
- Produces: `buildXiaohongshuConversionPrompt()`.
- Produces: `generateXiaohongshuArticle()`.
- Produces: `handleXiaohongshuRequest()` returning `{ status, payload }`.

- [ ] **Step 1: Write failing handler tests**

Create `src/app/api/ai/xiaohongshu/handler.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_PUBLISH_VOICE } from "@/lib/mock-data";
import { validResult } from "@/lib/xiaohongshu/test-fixtures";
import { handleXiaohongshuRequest } from "./handler";

const validRequest = {
  sourceContent: {
    id: "wechat-1",
    title: "公众号标题",
    digest: "公众号摘要",
    body: "公众号正文包含 25 项任务。",
    cta: "欢迎讨论",
    supplementaryNotes: "25 项任务是原文事实。",
  },
  voice: DEMO_PUBLISH_VOICE,
  llm: null,
};

test("rejects an empty source body without calling the generator", async () => {
  let called = false;
  const response = await handleXiaohongshuRequest(
    {
      sourceContent: { id: "wechat-1", title: "标题", body: "" },
      voice: DEMO_PUBLISH_VOICE,
      llm: null,
    },
    async () => { called = true; throw new Error("must not run"); }
  );
  assert.equal(response.status, 400);
  assert.equal(called, false);
  assert.deepEqual(response.payload, { message: "请先填写公众号正文" });
});

test("returns the validated generator result", async () => {
  const response = await handleXiaohongshuRequest(validRequest, async () => validResult);
  assert.equal(response.status, 200);
  assert.deepEqual(response.payload, validResult);
});

test("turns generator errors into a stable 500 response", async () => {
  const response = await handleXiaohongshuRequest(validRequest, async () => {
    throw new Error("模型暂时不可用");
  });
  assert.equal(response.status, 500);
  assert.deepEqual(response.payload, { message: "模型暂时不可用" });
});
```

- [ ] **Step 2: Run the handler test and confirm it fails**

Run:

```powershell
npm test -- src/app/api/ai/xiaohongshu/handler.test.ts
```

Expected: FAIL because `handler.ts` does not exist.

- [ ] **Step 3: Implement the conversion prompt and generator**

Add `buildXiaohongshuConversionPrompt()` with this signature:

```ts
export function buildXiaohongshuConversionPrompt(input: {
  title: string;
  digest?: string;
  body: string;
  cta?: string;
  supplementaryNotes?: string;
}): string;
```

The returned prompt must name both output keys, require 5–8 hashtags per variant and 5–8 images, include the exact source article, and include these hard rules verbatim in Chinese:

```text
公众号正文是唯一事实基线。保留所有数字、实体、案例和结论边界。
禁止虚构“亲测”、使用时长、结果提升、个人身份或第一人称经历。
professional 为 600～900 字的专业轻表达；social 为 400～700 字的强氛围表达。
图片默认 3:4、1080×1440；首张 role=cover，末张 role=ending，index 从 1 连续递增。
每张 prompt 必须包含统一视觉方向、精确中文图中文字、构图、安全边距和可读性要求。
```

Create `src/lib/ai/xiaohongshu-prompt.test.ts` before implementing the prompt:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildXiaohongshuConversionPrompt } from "./xiaohongshu-prompt";

test("conversion prompt preserves facts and requests both tones", () => {
  const prompt = buildXiaohongshuConversionPrompt({
    title: "公众号标题",
    digest: "摘要",
    body: "原文明确包含 25 项任务。",
    cta: "欢迎讨论",
    supplementaryNotes: "数字不得改变。",
  });
  assert.match(prompt, /唯一事实基线/);
  assert.match(prompt, /禁止虚构/);
  assert.match(prompt, /professional/);
  assert.match(prompt, /social/);
  assert.match(prompt, /5～8/);
  assert.match(prompt, /25 项任务/);
});
```

Run `npm test -- src/lib/ai/xiaohongshu-prompt.test.ts` and expect FAIL because the prompt builder does not exist. Then implement the function and rerun the same command; expect PASS.

Add to `src/lib/ai/generators/index.ts`:

```ts
export async function generateXiaohongshuArticle(
  input: {
    voice: PublishVoice;
    sourceContent: {
      id: string;
      title: string;
      digest?: string;
      body: string;
      cta?: string;
      supplementaryNotes?: string;
    };
  } & WithLLM
): Promise<XiaohongshuGenerationResult> {
  const provider = getLLMProvider(input.llm);
  const messages = createBaseMessages(
    input.voice,
    null,
    { materials: [], historyTitles: [input.sourceContent.title] },
    buildXiaohongshuConversionPrompt(input.sourceContent)
  );
  return provider.generateStructuredOutput(messages, xiaohongshuOutputSchema);
}
```

- [ ] **Step 4: Implement the testable handler and thin Route Handler**

`handleXiaohongshuRequest()` must accept an unknown body and an injectable generator:

```ts
export async function handleXiaohongshuRequest(
  body: unknown,
  generate: typeof generateXiaohongshuArticle = generateXiaohongshuArticle
): Promise<{ status: number; payload: unknown }>;
```

Validate the request with a local Zod schema, reject blank source body with status 400, parse the generator result again with `xiaohongshuOutputSchema`, and map thrown errors to `{ status: 500, payload: { message } }`.

Keep `route.ts` as the Next.js adapter:

```ts
import { NextResponse } from "next/server";
import { handleXiaohongshuRequest } from "./handler";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = await handleXiaohongshuRequest(body);
  return NextResponse.json(result.payload, { status: result.status });
}
```

- [ ] **Step 5: Run API tests and typecheck**

Run:

```powershell
npm test -- src/app/api/ai/xiaohongshu/handler.test.ts
npx tsc --noEmit
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit isolated Task 2 changes**

Inspect the generator file carefully because it already has uncommitted work.

```powershell
git diff --cached
git commit -m "feat: generate Xiaohongshu article variants"
```

Expected: no unrelated generator changes are staged.

---

### Task 3: Build publish checks and the manual publishing panel

**Files:**
- Create: `src/lib/xiaohongshu/publish.ts`
- Create: `src/lib/xiaohongshu/publish.test.ts`
- Create: `src/components/shared/xiaohongshu-publish-panel.tsx`

**Interfaces:**
- Consumes: `XiaohongshuDraftData`, `XiaohongshuTone`, and `ContentReview`.
- Produces: `buildXiaohongshuPublishChecks()`, `buildXiaohongshuNoteText()`, `buildXiaohongshuPromptText()`, and `buildXiaohongshuPublishMarkdown()`.
- Produces: `<XiaohongshuPublishPanel data tone review />`.

- [ ] **Step 1: Write failing publish utility tests**

Create tests that assert these exact behaviors:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import type { XiaohongshuDraftData } from "@/types/domain";
import { validResult } from "./test-fixtures";
import {
  buildXiaohongshuNoteText,
  buildXiaohongshuPublishChecks,
  buildXiaohongshuPublishMarkdown,
} from "./publish";

const draftData: XiaohongshuDraftData = {
  sourceContentId: "wechat-1",
  activeTone: "professional",
  ...validResult,
};
const variant = draftData.variants.professional;

test("builds a complete note with normalized hash tags", () => {
  assert.equal(
    buildXiaohongshuNoteText(variant),
    "专业版标题\n\n专业版正文\n\n你会怎么做？\n\n#AI工作流 #组织进化 #职场成长 #效率工具 #知识管理"
  );
});

test("blocks full publish when the image plan is incomplete", () => {
  const checks = buildXiaohongshuPublishChecks({
    data: { ...draftData, imagePlan: draftData.imagePlan.slice(0, 4) },
    tone: "professional",
    review: undefined,
  });
  assert.equal(checks.find((item) => item.id === "images")?.ok, false);
});

test("exports both tones and every numbered prompt", () => {
  const markdown = buildXiaohongshuPublishMarkdown(draftData, "professional", "公众号标题");
  assert.match(markdown, /## 当前发布版本：专业轻表达/);
  assert.match(markdown, /## 备选版本：强氛围版/);
  assert.match(markdown, /### 图 1 · 封面/);
  assert.match(markdown, /### 图 5 · 收尾/);
});
```

- [ ] **Step 2: Run the publish test and confirm it fails**

Run:

```powershell
npm test -- src/lib/xiaohongshu/publish.test.ts
```

Expected: FAIL because `publish.ts` does not exist.

- [ ] **Step 3: Implement the pure publishing functions**

Define checks as:

```ts
export interface XiaohongshuPublishCheck {
  id: "title" | "body" | "cta" | "hashtags" | "images" | "review";
  label: string;
  ok: boolean;
  hint?: string;
  blocking: boolean;
}
```

`buildXiaohongshuPublishChecks()` must mark title, body, CTA, 5–8 hashtags, and the complete ordered 5–8 image plan as blocking. Review is blocking only when the latest review contains a `high` issue. `buildXiaohongshuNoteText()` must normalize tags by removing a leading `#` before adding exactly one `#`. The Markdown builder must include source title, current tone, backup tone, visual direction, and every image prompt field.

- [ ] **Step 4: Implement the publishing panel**

Create a client component with this public contract:

```ts
interface XiaohongshuPublishPanelProps {
  data: XiaohongshuDraftData;
  tone: XiaohongshuTone;
  sourceTitle?: string;
  review?: ContentReview;
  onRegenerateImages: () => Promise<void>;
  imageRegenerating: boolean;
}
```

Render the check list, mobile-width note preview, numbered prompt cards, and buttons for:

```text
复制完整笔记
复制标题
复制正文和话题
复制全部生图提示词
导出小红书发布包（Markdown）
重新规划图片
```

Use `navigator.clipboard.writeText()` only inside click handlers. Catch clipboard and export failures and show Sonner errors. Download the Markdown with `new Blob([markdown], { type: "text/markdown;charset=utf-8" })`, an object URL, and a cleaned `<title>-xiaohongshu.md` filename.

- [ ] **Step 5: Run publish tests and lint the new files**

Run:

```powershell
npm test -- src/lib/xiaohongshu/publish.test.ts
npx eslint src/lib/xiaohongshu/publish.ts src/components/shared/xiaohongshu-publish-panel.tsx
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit Task 3**

```powershell
git add src/lib/xiaohongshu/publish.ts src/lib/xiaohongshu/publish.test.ts src/components/shared/xiaohongshu-publish-panel.tsx
git diff --cached
git commit -m "feat: add Xiaohongshu publishing kit"
```

Expected: the commit contains only the publishing kit.

---

### Task 4: Integrate dual-tone editing and Xiaohongshu review

**Files:**
- Modify: `src/lib/ai/xiaohongshu-prompt.ts`
- Modify: `src/lib/ai/reviewers/index.ts`
- Modify: `src/app/api/ai/review/route.ts`
- Create: `src/components/shared/xiaohongshu-editor.tsx`
- Modify: `src/app/(workspace)/content/content-editor.tsx:88-1035`
- Modify: `src/lib/store/app-store.tsx:70-105`

**Interfaces:**
- Consumes: conversion API, draft helpers, publish panel, `upsertContent()`, `addVersion()`, and existing review storage.
- Produces: platform-aware review and the complete linked-draft editing flow.

- [ ] **Step 1: Add a Xiaohongshu review prompt test**

Extend the prompt test file with:

```ts
import { validResult } from "@/lib/xiaohongshu/test-fixtures";
import { buildXiaohongshuReviewPrompt } from "./xiaohongshu-prompt";

test("Xiaohongshu review prompt covers source facts and image continuity", () => {
  const prompt = buildXiaohongshuReviewPrompt({
    sourceBody: "原文数字为 25 项任务。",
    title: "改编标题",
    body: "改编正文",
    cta: "你怎么看？",
    hashtags: ["AI工作流", "组织进化", "职场成长", "效率工具", "知识管理"],
    visualDirection: "米白知识卡片",
    imagePlan: validResult.imagePlan,
    targetAudience: "企业管理者",
  });
  assert.match(prompt, /事实一致性/);
  assert.match(prompt, /虚构个人经历/);
  assert.match(prompt, /图片规划/);
  assert.match(prompt, /25 项任务/);
});
```

- [ ] **Step 2: Run the prompt test and confirm it fails**

Run:

```powershell
npm test -- src/lib/ai/xiaohongshu-prompt.test.ts
```

Expected: FAIL because `buildXiaohongshuReviewPrompt` does not exist.

- [ ] **Step 3: Implement platform-aware review**

Add:

```ts
export async function reviewXiaohongshuContent(input: {
  sourceBody: string;
  title: string;
  body: string;
  cta: string;
  hashtags: string[];
  visualDirection: string;
  imagePlan: XiaohongshuImagePrompt[];
  targetAudience: string;
  llm?: Partial<LLMClientSettings> | null;
})
```

Use `buildXiaohongshuReviewPrompt()` and the existing `reviewOutputSchema`. Update `/api/ai/review` so `body.platform === "xiaohongshu"` calls the new reviewer with the source body and image plan; otherwise preserve the current WeChat reviewer call exactly.

- [ ] **Step 4: Implement the focused Xiaohongshu editor**

Create `XiaohongshuEditor` with this contract:

```ts
interface XiaohongshuEditorProps {
  sourceContent: ContentItem | null;
  content: ContentItem | null;
  latestReview?: ContentReview;
  publishVoice: PublishVoice;
  conversionRequestId: number;
  onSave: (content: ContentItem, source: "ai_generate" | "user_edit" | "ai_rewrite") => void;
  onReviewSaved: (review: ContentReview) => void;
  onBackToWechat: () => void;
}
```

The component must:

- Show an empty state with “一键转小红书” when `content?.xiaohongshu` is missing.
- Track the last handled request ID in a ref and start conversion once when a new positive `conversionRequestId` arrives, so normal re-renders cannot duplicate the request.
- POST the current source draft to `/api/ai/xiaohongshu` with `withLLMPayload()`.
- Keep the existing content unchanged until a complete successful response is received.
- Use `createXiaohongshuContent()` for first generation and repeated conversion.
- Ask for confirmation before repeated full conversion.
- Save the current two variants and image plan as a version before repeated full conversion, including unsaved local edits.
- Store local edits for both tones and save through `saveXiaohongshuVariant()`.
- Render `专业轻表达` and `强氛围版 ✨` tabs with separate title, body, CTA, and comma-or-space-separated hashtag inputs.
- Render the existing status options for the Xiaohongshu item and reject transitions to `待发布` or `已发布` while a blocking publish check remains.
- POST platform-specific data to `/api/ai/review` and save the returned `ContentReview` against the Xiaohongshu content ID.
- Regenerate images through the same conversion endpoint, discard the returned text variants, and replace only `visualDirection` and `imagePlan` after successful validation.

- [ ] **Step 5: Wire platform selection into the existing content page**

In `content-editor.tsx` add:

```ts
const [activePlatform, setActivePlatform] = useState<"wechat" | "xiaohongshu">("wechat");
const [xiaohongshuConversionRequestId, setXiaohongshuConversionRequestId] = useState(0);

const xiaohongshuContent = useMemo(
  () => contentItems.find((item) =>
    item.topicId === activeTopicId && item.platform === "xiaohongshu"
  ) ?? null,
  [contentItems, activeTopicId]
);
```

Reset `activePlatform` to `wechat` when the user selects another topic. Render the platform switch in the right-hand editor header. Keep all current WeChat JSX under the WeChat branch and render `XiaohongshuEditor` in the Xiaohongshu branch. Add “一键转小红书” to the existing WeChat action row; its click handler increments `xiaohongshuConversionRequestId` and selects the Xiaohongshu branch. Pass the counter to `XiaohongshuEditor`, which performs exactly one conversion request and then marks the request handled. Switching platforms by itself must never call the API.

Build the `sourceContent` prop from the current WeChat draft state rather than the last persisted item so unsaved title, body, digest, CTA, and supplementary notes are included in conversion.

When `onSave` is called, upsert the content and add a `ContentVersion` containing the complete `xiaohongshu` snapshot. Before creating that version, compute its version number from versions matching the Xiaohongshu content ID.

- [ ] **Step 6: Normalize optional data during store hydration**

In `migrateState()`, map content items through the existing seed restoration and then `normalizeXiaohongshuContent()`. Do not change the storage key; the new fields are optional and JSON-compatible.

- [ ] **Step 7: Run focused tests, lint, and typecheck**

Run:

```powershell
npm test
npx eslint src/lib/ai/xiaohongshu-prompt.ts src/lib/ai/reviewers/index.ts src/app/api/ai/review/route.ts src/components/shared/xiaohongshu-editor.tsx 'src/app/(workspace)/content/content-editor.tsx' src/lib/store/app-store.tsx
npx tsc --noEmit
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit isolated Task 4 changes**

`content-editor.tsx` and the store already contain user work. Stage only reviewed task hunks and confirm the cached diff before committing.

```powershell
git diff --cached
git commit -m "feat: integrate Xiaohongshu editing workflow"
```

Expected: no existing Markdown import, image upload, fact diff, or WeChat publishing changes are included accidentally.

---

### Task 5: Verify the complete workflow and compatibility

**Files:**
- Modify only files required by failures found in this task.

**Interfaces:**
- Consumes: the complete implementation from Tasks 1–4.
- Produces: a verified production build and browser-tested user flow.

- [ ] **Step 1: Run all automated checks**

Run:

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Expected: all commands exit 0. Diagnose each failure before changing code; do not repeat a failing command without a concrete fix.

- [ ] **Step 2: Start the application for browser verification**

Run:

```powershell
npm run dev
```

Expected: Next.js reports a local URL and serves the content workspace without runtime errors.

- [ ] **Step 3: Verify the successful linked-draft flow**

Using the browser against a WeChat article with numbers and named entities:

1. Open the content page and confirm the existing WeChat draft renders unchanged.
2. Click “一键转小红书” and confirm the page switches only after a valid response.
3. Confirm one linked Xiaohongshu item is created with five to eight image prompts.
4. Edit the professional title, switch to social, edit its body, switch back, and confirm both edits persist.
5. Save, reload, and confirm the active tone, both variants, and image plan restore from local storage.
6. Run review and confirm it is attached to the Xiaohongshu content item.
7. Copy the complete note and all image prompts; confirm the clipboard text contains the expected tags and numbered images.
8. Export Markdown and confirm it contains the current version, backup version, visual direction, and every prompt.

- [ ] **Step 4: Verify failure and compatibility paths**

1. Clear the source body and confirm conversion is blocked locally.
2. Use an invalid or missing API key and confirm the existing Xiaohongshu draft remains unchanged.
3. Trigger repeated conversion and confirm a warning appears before overwrite.
4. Replan images and confirm both text variants remain byte-for-byte unchanged.
5. Return to the WeChat platform and verify save, review, rich-text preview, copy, Word export, and Markdown backup remain available.
6. Open dashboard and calendar views and confirm the Xiaohongshu item uses the existing platform label and status flow.

- [ ] **Step 5: Inspect the final diff and commit only owned fixes**

Run:

```powershell
git status --short
git diff --check
git diff --stat
```

Expected: no conflict markers, whitespace errors, generated build files, credentials, `.superpowers/` mockups, or unrelated user changes are staged. Commit only fixes made during this task with:

```powershell
git diff --cached
git commit -m "test: verify Xiaohongshu conversion workflow"
```

If no verification fix changed tracked files, skip the empty commit and report the successful commands and browser scenarios.
