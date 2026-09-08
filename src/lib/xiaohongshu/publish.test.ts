import assert from "node:assert/strict";
import test from "node:test";
import type { XiaohongshuDraftData } from "@/types/domain";
import { validResult } from "./test-fixtures";
import {
  buildXiaohongshuNoteText,
  buildXiaohongshuPublishChecks,
  buildXiaohongshuPublishMarkdown,
  buildXiaohongshuPublishBundle,
  buildXiaohongshuPromptText,
} from "./publish";

const draftData: XiaohongshuDraftData = {
  sourceContentId: "wechat-1",
  activeTone: "professional",
  ...validResult,
};
const variant = draftData.variants.professional;

test("builds a complete note as title plus body with inline hashtags", () => {
  assert.equal(
    buildXiaohongshuNoteText(variant),
    "专业版标题\n\n专业版正文\n\n你会怎么做？\n\n#AI工作流 #组织进化 #职场成长 #效率工具 #知识管理"
  );
});

test("publish ZIP contains ordered image bytes and selected copy with tags from body", async (t) => {
  const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=", "base64"));
  const urls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    urls.push(url);
    return new Response(png, { headers: { "Content-Type": "image/png" } });
  });
  const data = {
    ...draftData,
    variants: {
      ...draftData.variants,
      social: { ...draftData.variants.social, hashtags: ["过期标签"] },
    },
    imagePlan: draftData.imagePlan.map((image) => ({
      ...image,
      imageUrl: `/article-assets/${image.index}.png`,
    })).reverse(),
  };
  const { blob, fileName } = await buildXiaohongshuPublishBundle(data, "social", "来源文章");
  assert.ok(fileName.endsWith(".zip"));
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  assert.equal(await zip.file("标题.txt")!.async("string"), data.variants.social.title);
  assert.equal(await zip.file("正文.txt")!.async("string"), data.variants.social.body);
  assert.equal(await zip.file("标签.txt")!.async("string"), "#AI工作流 #打工人 #效率提升 #职场干货 #成长思维");
  assert.equal(await zip.file("完整笔记.txt")!.async("string"), buildXiaohongshuNoteText(data.variants.social));
  assert.match(await zip.file("备选文案/完整笔记.txt")!.async("string"), /专业版标题/);
  const files = Object.keys(zip.files).filter((name) => name.startsWith("images/") && !zip.files[name].dir);
  assert.deepEqual(files, ["images/01-cover.png", "images/02-content.png", "images/03-content.png", "images/04-content.png", "images/05-ending.png"]);
  for (const name of files) assert.deepEqual(await zip.file(name)!.async("uint8array"), png);
  assert.equal(urls.length, 5);
  const markdown = await zip.file("发布说明.md")!.async("string");
  assert.match(markdown, /images\/01-cover.png/);
  assert.doesNotMatch(markdown, /\/article-assets\//);
});

test("publish ZIP rejects missing images before downloading", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => { throw new Error("unexpected fetch"); });
  await assert.rejects(buildXiaohongshuPublishBundle(draftData, "professional"), /图 1.*未生成/);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("publish ZIP embeds base64 images without fetching", async (t) => {
  const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=";
  const fetchMock = t.mock.method(globalThis, "fetch", async () => { throw new Error("unexpected fetch"); });
  const data = {
    ...draftData,
    imagePlan: draftData.imagePlan.map((image) => ({ ...image, imageUrl: `data:image/png;base64,${base64}` })),
  };
  const { blob } = await buildXiaohongshuPublishBundle(data, "professional");
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  assert.equal(await zip.file("images/01-cover.png")!.async("base64"), base64);
  assert.equal(fetchMock.mock.callCount(), 0);
});

for (const failure of ["http", "html", "empty"]) {
  test(`publish ZIP reports the failed image instead of exporting a partial package (${failure})`, async (t) => {
    t.mock.method(globalThis, "fetch", async () => failure === "http"
      ? new Response("missing", { status: 404 })
      : new Response(failure === "html" ? "<html>error</html>" : "", {
          headers: { "Content-Type": failure === "html" ? "text/html" : "image/png" },
        }));
    const data = { ...draftData, imagePlan: draftData.imagePlan.map((image) => ({ ...image, imageUrl: `/article-assets/${image.index}.png` })) };
    await assert.rejects(buildXiaohongshuPublishBundle(data, "professional"), /图 1.*导出失败/);
  });
}

test("copied prompts enforce no corner numbering even for older plans", () => {
  assert.match(buildXiaohongshuPromptText(draftData), /整组图片统一不显示页码和角标/);
});

test("blocks publish when body lacks enough #hashtags", () => {
  const checks = buildXiaohongshuPublishChecks({
    data: {
      ...draftData,
      variants: {
        ...draftData.variants,
        professional: {
          ...variant,
          body: "只有正文没有话题",
          hashtags: [],
        },
      },
    },
    tone: "professional",
    review: undefined,
  });
  assert.equal(checks.find((item) => item.id === "hashtags")?.ok, false);
});

test("blocks publish when title or body exceeds platform limits", () => {
  const overTitle = buildXiaohongshuPublishChecks({
    data: {
      ...draftData,
      variants: {
        ...draftData.variants,
        professional: {
          ...variant,
          title: "一二三四五六七八九十一二三四五六七八九十超",
        },
      },
    },
    tone: "professional",
    review: undefined,
  });
  assert.equal(overTitle.find((item) => item.id === "title")?.ok, false);

  const overBody = buildXiaohongshuPublishChecks({
    data: {
      ...draftData,
      variants: {
        ...draftData.variants,
        professional: {
          ...variant,
          body: "字".repeat(1001),
        },
      },
    },
    tone: "professional",
    review: undefined,
  });
  assert.equal(overBody.find((item) => item.id === "body")?.ok, false);
});

test("exports both tones and every numbered prompt", () => {
  const markdown = buildXiaohongshuPublishMarkdown(
    draftData,
    "professional",
    "公众号标题"
  );
  assert.match(markdown, /## 当前发布版本：专业轻表达/);
  assert.match(markdown, /## 备选版本：强氛围版/);
  assert.match(markdown, /来源稿件：公众号标题/);
  assert.match(markdown, new RegExp(validResult.visualDirection));
  assert.match(markdown, new RegExp(validResult.variants.professional.body));
  assert.match(markdown, new RegExp(validResult.variants.social.body));
  assert.match(markdown, /### 图 1 · 封面/);
  assert.match(markdown, /### 图 5 · 收尾/);

  for (const image of validResult.imagePlan) {
    assert.match(markdown, new RegExp(image.objective));
    assert.match(markdown, new RegExp(image.overlayText));
    assert.match(markdown, new RegExp(image.composition));
    assert.match(markdown, new RegExp(image.prompt));
  }
});
