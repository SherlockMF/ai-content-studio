"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { uploadArticleImage } from "@/lib/api-client";
import { extractArticleSlots, replaceArticleSlot, recoverEmbeddedSlotImage, type ArticleSlot } from "@/lib/illustrations/article-slots";
import { PLACEHOLDER_RE } from "@/lib/export-assets";
import type { MutableRefObject, ReactNode } from "react";

export function ArticleImageSlots({ body, topicId, draftRef, onChange, actions }: {
  body: string;
  topicId: string;
  draftRef: MutableRefObject<{ topicId: string; body: string }>;
  onChange: (body: string) => void;
  actions?: ReactNode;
}) {
  const slots = useMemo(() => extractArticleSlots(body), [body]);
  const [uploading, setUploading] = useState<number | null>(null);

  async function upload(slot: ArticleSlot, index: number, file: File) {
    if (!file.type.startsWith("image/")) { toast.error("请选择图片文件"); return; }
    setUploading(index);
    try {
      const url = await uploadArticleImage(file);
      const current = draftRef.current;
      const next = current.topicId === topicId ? replaceArticleSlot(current.body, slot, url) : null;
      if (!next) throw new Error("正文或稿件已变化，请重新选择对应图位上传");
      onChange(next);
      toast.success(`第 ${index + 1} 张图片已替换，预览会自动更新`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "图片上传失败");
    } finally { setUploading(null); }
  }

  if (!slots.length) return null;
  return <section id="article-image-slots" className="space-y-3 rounded-lg border bg-white p-4" aria-label="正文配图与提示词">
    <div><h3 className="text-sm font-semibold">正文配图与提示词</h3><p className="text-xs text-slate-500">按正文顺序显示；将图片拖到对应图位或点击选择，上传后自动替换。</p></div>
    {actions}
    {slots.map((slot, index) => <div key={`${index}-${slot.alt}`} className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2"><strong className="text-sm">{index + 1}. {slot.alt || "未命名配图"}</strong><span className="text-xs text-slate-500">{PLACEHOLDER_RE.test(slot.url) ? "待上传" : "已插入"}</span></div>
      {slot.prompts.length ? slot.prompts.map((prompt, promptIndex) => <div key={promptIndex} className="space-y-1"><p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{slot.prompts.length > 1 ? `提示词 ${promptIndex + 1}：` : "提示词："}{prompt}</p><button type="button" className="text-xs underline" onClick={() => void navigator.clipboard.writeText(prompt).then(() => toast.success("提示词已复制")).catch(() => toast.error("复制失败"))}>复制提示词</button></div>) : <p className="text-xs text-slate-500">此图位没有关联的提示词</p>}
      {slot.embeddedImages.length > 0 && <div className="rounded bg-amber-50 p-2 text-xs text-amber-900">发现 {slot.embeddedImages.length} 张图片误插在提示词注释中。{slot.embeddedImages.length === 1 && PLACEHOLDER_RE.test(slot.url) ? <button type="button" className="ml-2 underline" onClick={() => { const next = recoverEmbeddedSlotImage(draftRef.current.body, slot); if (next && draftRef.current.topicId === topicId) { onChange(next); toast.success("已将误插图片恢复到此图位"); } else toast.error("正文已变化，请重新操作"); }}>恢复到此图位</button> : "请检查正文后手动处理。"}</div>}
      {!PLACEHOLDER_RE.test(slot.url) && <img src={slot.url} alt={slot.alt} className="max-h-32 max-w-full rounded object-contain" />}
      <label onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file && uploading === null) void upload(slot, index, file); }} className="block cursor-pointer rounded border border-dashed p-3 text-center text-xs text-slate-600">
        {uploading === index ? "上传中…" : "拖拽图片到这里，或点击选择图片"}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={uploading !== null} className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(slot, index, file); event.target.value = ""; }} />
      </label>
    </div>)}
  </section>;
}
