"use client";

import { getWechatTheme, WECHAT_THEMES, type WechatLayoutSettings } from "@/lib/markdown/wechat-theme";

export function WechatThemePicker({ layout, onChange }: {
  layout: WechatLayoutSettings;
  onChange: (value: WechatLayoutSettings) => void;
}) {
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="mb-3 text-sm font-medium text-slate-800">文章主题</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {WECHAT_THEMES.map((theme) => (
          <label key={theme.id} className="relative cursor-pointer">
            <input
              type="radio"
              name="wechat-theme"
              value={theme.id}
              checked={layout.theme === theme.id}
              onChange={() => onChange({ ...layout, theme: theme.id, numberSections: Boolean(theme.chapter) })}
              className="peer sr-only"
            />
            <span className="block h-full rounded-lg border border-slate-200 bg-white p-2.5 transition-colors peer-checked:border-slate-800 peer-checked:ring-1 peer-checked:ring-slate-800 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-slate-600">
              <span aria-hidden="true" className="mb-2 block h-20 overflow-hidden rounded border border-black/5 px-3 py-2" style={{ background: theme.paper ?? "#ffffff" }}>
                {theme.chapter ? <span className="block text-[10px] font-bold tracking-widest" style={{ color: theme.accent }}>01</span> : <span className="block h-3" />}
                <span className="mb-2 block text-[11px] font-bold" style={{ color: theme.accent ?? "#334155", borderBottom: theme.id === "editorial" ? "1px solid #924830" : undefined }}>
                  让观点清晰可读
                </span>
                <span className="mb-1 block h-1 w-full bg-slate-300/70" />
                <span className="mb-1 block h-1 w-4/5" style={{ background: theme.accent ?? "#94a3b8", opacity: 0.4 }} />
                <span className="block h-1 w-3/5 bg-slate-300/70" />
              </span>
              <span className="block text-xs font-semibold text-slate-900">{theme.label}</span>
              <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">{theme.description ?? (theme.id === "tech-eval" ? "经典左线标题" : "经典居中标题")}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-700">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={layout.numberSections} onChange={(event) => onChange({ ...layout, numberSections: event.target.checked })} className="size-4 accent-slate-800" />
          章节编号
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={layout.emphasize} disabled={!getWechatTheme(layout.theme).highlight} onChange={(event) => onChange({ ...layout, emphasize: event.target.checked })} className="size-4 accent-slate-800 disabled:opacity-40" />
          主题重点样式
        </label>
        <span className="text-slate-500">新主题可装饰原文加粗；排版设置随稿件自动保存。</span>
      </div>
    </fieldset>
  );
}
