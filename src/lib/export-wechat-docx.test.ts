import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { buildWechatPublishBundle } from "./export-wechat-docx";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=";

test("publish package includes a Word with embedded images, ordered originals and metadata", async () => {
  const result = await buildWechatPublishBundle({ title: "测试文章", digest: "文章摘要", body: `正文内容。\n\n![封面](${png})\n\n<!-- GPT 配图提示词\n内部提示词\n-->\n\n![正文图](${png})` });
  const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
  assert.match(result.fileName, /公众号发布包\.zip$/);
  assert.equal(result.imageCount, 2);
  assert.ok(zip.file("images/01-封面.png"));
  assert.ok(zip.file("images/02-正文图.png"));
  assert.match(await zip.file("标题和摘要.txt")!.async("string"), /测试文章[\s\S]*文章摘要/);
  const docxFile = Object.keys(zip.files).find((name) => name.endsWith(".docx"))!;
  const docx = await JSZip.loadAsync(await zip.file(docxFile)!.async("uint8array"));
  const xml = await docx.file("word/document.xml")!.async("string");
  assert.match(xml, /正文内容/);
  assert.equal((xml.match(/<w:drawing>/g) ?? []).length, 2);
  assert.doesNotMatch(xml, /内部提示词|GPT 配图/);
});

test("incomplete or unsupported pictures block export instead of silently producing an incomplete package", async () => {
  for (const url of ["待替换-公众号配图-1", "https://example.com/image.png"]) {
    await assert.rejects(buildWechatPublishBundle({ title: "文章", body: `![配图](${url})` }), /图片|配图/);
  }
});

test("image payload containing fill/link text is still embedded in Word", async () => {
  const original = Buffer.from(png.split(",")[1], "base64");
  const bytes = Buffer.concat([original, Buffer.alloc((3 - original.length % 3) % 3), Buffer.from("filllink", "base64")]);
  const dataUrl = `data:image/png;base64,${bytes.toString("base64")}`;
  assert.match(dataUrl, /fill.*link/i);
  const result = await buildWechatPublishBundle({ title: "编码误判回归", body: `![真实图片](${dataUrl})` });
  const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
  const name = Object.keys(zip.files).find((entry) => entry.endsWith(".docx"))!;
  const docx = await JSZip.loadAsync(await zip.file(name)!.async("uint8array"));
  assert.match(await docx.file("word/document.xml")!.async("string"), /<w:drawing>/);
});

test("local article assets become embedded Word media and missing files block the package", async (t) => {
  const bytes = Buffer.from(png.split(",")[1], "base64");
  const requests: string[] = [];
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: "https://workspace.test" } } });
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });
  t.mock.method(globalThis, "fetch", async (url: string) => {
    requests.push(url);
    return url.endsWith("/missing.png")
      ? new Response(null, { status: 404 })
      : new Response(bytes, { headers: { "Content-Type": "image/png" } });
  });
  const result = await buildWechatPublishBundle({ title: "本地图验证", body: "![封面](/article-assets/real.png)" });
  const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
  const name = Object.keys(zip.files).find(entry => entry.endsWith(".docx"))!;
  const docx = await JSZip.loadAsync(await zip.file(name)!.async("uint8array"));
  const xml = await docx.file("word/document.xml")!.async("string");
  const rels = await docx.file("word/_rels/document.xml.rels")!.async("string");
  const embedId = xml.match(/r:embed="([^"]+)"/)?.[1];
  assert.ok(embedId);
  const relationship = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${embedId}"[^>]*/>`))?.[0];
  assert.ok(relationship);
  assert.doesNotMatch(relationship, /TargetMode="External"/);
  const target = relationship.match(/Target="([^"]+)"/)?.[1];
  assert.ok(target);
  assert.deepEqual(await docx.file(`word/${target}`)!.async("nodebuffer"), bytes);
  assert.deepEqual(await zip.file("images/01-封面.png")!.async("nodebuffer"), bytes);
  assert.doesNotMatch(xml, /配图占位|\/article-assets\//);
  assert.deepEqual(requests, ["https://workspace.test/article-assets/real.png"]);
  await assert.rejects(buildWechatPublishBundle({ title: "缺图", body: "![缺图](/article-assets/missing.png)" }), /无法读取图片/);
});
