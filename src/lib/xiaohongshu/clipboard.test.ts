import assert from "node:assert/strict";
import test from "node:test";
import { buildNoteClipboardHtml, copyNotePreservingLines } from "./clipboard";

test("粘贴 HTML 显式保留段内换行和空行，转义文字", () => {
  assert.equal(buildNoteClipboardHtml("第一行\r\n第二行\r\n\r\n<AI> & #话题"),
    '<div>第一行<br>第二行<br><br>&lt;AI&gt; &amp; #话题</div>');
});

test("富文本剪贴板不可用时回退纯文本并保留换行", async () => {
  const text = "第一行\n第二行\n\n下一段";
  let plain = "";
  await copyNotePreservingLines(text, { writeText: async value => { plain = value; } });
  assert.equal(plain, text);
});
