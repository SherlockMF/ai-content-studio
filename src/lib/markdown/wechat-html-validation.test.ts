import assert from "node:assert/strict";
import test from "node:test";
import { renderWechatHtml } from "./wechat-html";
import { validateWechatHtml } from "./wechat-html-validation";
import { WECHAT_THEMES } from "./wechat-theme";

test("all themes produce valid fragments for mixed Markdown without altering text", async () => {
  const md = '> 引言 **重点**。\n\n## 章节\n\nEnglish 2.5, 中文 **结论**。\n\n- 条目\n  - 子项\n\n3. 第三项\n\n| A | B |\n| --- | --- |\n| 一 | 二 |\n\n```ts\nx < 2;\n```\n\n![图](/article-assets/test.png)\n\n---';
  for (const theme of WECHAT_THEMES) {
    const html = await renderWechatHtml(md, { theme: theme.id, numberSections: true });
    assert.deepEqual(validateWechatHtml(html).errors, [], theme.id);
    assert.match(html, /English 2.5, 中文/);
    assert.match(html, /<ol[^>]+start="3"/);
  }
});

test("validator catches unsupported tags, attributes, styles and unwrapped text", () => {
  for (const html of [
    '<section><div>正文</div></section>',
    '<section><span class="x" leaf="">正文</span></section>',
    '<section><span leaf="" onclick="x()">正文</span></section>',
    '<section style="display:grid"><span leaf="">正文</span></section>',
    '<section><p>正文</p></section>',
    '<section><img src="javascript:alert(1)"></section>',
    '<section><p><span leaf="">正文</p></section>',
    '<section><p><p><span leaf="">正文</span></p></p></section>',
  ]) assert.ok(validateWechatHtml(html).errors.length, html);
});

test("escaped examples are text, gradient style is a warning", () => {
  const result = validateWechatHtml('<section><span leaf="">&lt;script&gt; class="demo"</span></section>');
  assert.deepEqual(result.errors, []);
  const gradient = validateWechatHtml('<section style="background:linear-gradient(red,blue)"><span leaf="">文</span></section>');
  assert.equal(gradient.errors.length, 0);
  assert.ok(gradient.warnings.length);
});
