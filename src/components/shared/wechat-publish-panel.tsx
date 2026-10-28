"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildWechatPublishBundle, buildWechatPublishClipboard } from "@/lib/export-wechat-docx";
import { buildArticleMarkdown, buildMarkdownZipBundle } from "@/lib/export-markdown-bundle";
import {
  buildWechatPublishChecks,
  copyWechatRichText,
  buildWechatPublishHtml,
  buildWechatHtmlDocument,
} from "@/lib/markdown/wechat-publish";
import { getWechatTheme, type WechatLayoutSettings } from "@/lib/markdown/wechat-theme";
import { validateWechatHtml } from "@/lib/markdown/wechat-html-validation";
import { WechatThemePicker } from "@/components/shared/wechat-theme-picker";
import { FactDiffReport } from "@/lib/fact-diff";
import { PublishChecks } from "@/components/shared/publish-checks";
import { copyWithToast, downloadBlob } from "@/lib/client-actions";
import { useContentState } from "@/lib/store/app-store";

interface WechatPublishPanelProps {
  title: string;
  digest: string;
  body: string;
  layout: WechatLayoutSettings;
  onLayoutChange: (value: WechatLayoutSettings) => void;
  reviewScore?: number;
  exportableLocalImages: number;
  placeholderImages: number;
  factDiff?: FactDiffReport | null;
  factDiffAcknowledged?: boolean;
}

export function WechatPublishPanel({
  title,
  digest,
  body,
  layout,
  onLayoutChange,
  reviewScore,
  exportableLocalImages,
  placeholderImages,
  factDiff,
  factDiffAcknowledged,
}: WechatPublishPanelProps) {
  const { contentItems } = useContentState();
  const xiaohongshuImageUrls = useMemo(() => contentItems
    .filter(item => item.platform === "xiaohongshu")
    .flatMap(item => item.xiaohongshu?.imagePlan.flatMap(image => image.imageUrl ? [image.imageUrl] : []) ?? []),
  [contentItems]);
  const { theme: themeId, numberSections, emphasize } = layout;
  const theme = getWechatTheme(themeId);
  const [preview, setPreview] = useState<{ key: string; html: string; error?: string; warnings: string[] } | null>(null);
  const [previewWidth, setPreviewWidth] = useState<"mobile" | "wide">("mobile");
  const previewKey = JSON.stringify([body, themeId, numberSections, emphasize]);
  const currentPreview = preview?.key === previewKey ? preview : null;
  const previewLoading = Boolean(body.trim()) && !currentPreview;
  const [copyLoading, setCopyLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const checks = useMemo(
    () =>
      buildWechatPublishChecks({
        title,
        digest,
        body,
        reviewScore,
        xiaohongshuImageUrls,
        factDiff,
        factDiffAcknowledged,
      }),
    [title, digest, body, reviewScore, factDiff, factDiffAcknowledged, xiaohongshuImageUrls]
  );

  const imageCheck = checks.find((c) => c.id === "images");
  const canCopyRichText =
    Boolean(body.trim()) &&
    checks
      .filter(
        (c) =>
          c.id !== "digest" &&
          c.id !== "review" &&
          c.id !== "images" &&
          c.id !== "table-preview-reminder" &&
          c.id !== "sticker-reminder"
      )
      .every((c) => c.ok) &&
    placeholderImages === 0;

  useEffect(() => {
    if (!body.trim()) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void buildWechatPublishHtml({ body, theme: themeId, numberSections, emphasize, embedImages: false, origin: window.location.origin })
        .then((html) => {
          if (!cancelled) setPreview({ key: previewKey, html, warnings: validateWechatHtml(html).warnings });
        })
        .catch((error: unknown) => {
          if (!cancelled) setPreview({ key: previewKey, html: "", warnings: [], error: error instanceof Error ? error.message : "预览生成失败" });
        });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [body, themeId, numberSections, emphasize, previewKey]);

  const checkPublishReady = () => {
    if (!body.trim()) {
      toast.error("请先填写正文");
      return false;
    }
    if (placeholderImages > 0) {
      toast.error(`还有 ${placeholderImages} 处待替换配图，请先插入本地图片`);
      return false;
    }
    const blocked = checks.find(
      (c) => !c.ok && c.id !== "digest" && c.id !== "review" && c.id !== "images"
    );
    if (blocked) {
      toast.error(blocked.hint || blocked.label);
      return false;
    }
    return true;
  };

  const handleCopyRichText = async () => {
    if (!checkPublishReady()) return;
    setCopyLoading(true);
    try {
      await copyWechatRichText({ body, title, digest, ...layout });
      toast.success("已复制公众号富文本，到微信后台粘贴即可");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "复制失败");
    } finally {
      setCopyLoading(false);
    }
  };

  const handleExportHtml = async () => {
    if (!checkPublishReady()) return;
    setExportLoading(true);
    try {
      const html = await buildWechatHtmlDocument({ body, title, ...layout });
      const base = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim().slice(0, 80) || "公众号正文";
      downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${base}-${theme.label}.html`);
      toast.success("排版 HTML 已下载，包含当前主题和内嵌图片");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "HTML 导出失败");
    } finally {
      setExportLoading(false);
    }
  };

  const handleCopyMeta = () =>
    copyWithToast(buildWechatPublishClipboard({ title, digest }), "标题与摘要已复制");

  const handleExportWord = async () => {
    const platformCheck = checks.find(check => check.id === "image-platform" && !check.ok);
    if (platformCheck) { toast.error(platformCheck.hint); return; }
    setExportLoading(true);
    try {
      const { blob, fileName, imageCount } = await buildWechatPublishBundle({
        title,
        digest,
        body,
      });
      downloadBlob(blob, fileName);
      toast.success(`公众号发布包已下载：Word + ${imageCount} 张图片 + 标题和摘要`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "公众号发布包导出失败");
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportZip = async () => {
    const platformCheck = checks.find(check => check.id === "image-platform" && !check.ok);
    if (platformCheck) { toast.error(platformCheck.hint); return; }
    setExportLoading(true);
    try {
      const { blob, fileName } = await buildMarkdownZipBundle({
        title,
        digest,
        body,
        includeTitle: false,
      });
      downloadBlob(blob, fileName);
      toast.success(
        exportableLocalImages > 0
          ? `备份包已下载，含 ${exportableLocalImages} 张图`
          : "备份包已下载"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "打包失败");
    } finally {
      setExportLoading(false);
    }
  };

  const handleCopyMarkdown = () =>
    copyWithToast(
      buildArticleMarkdown({ title, digest, body, includeTitle: false }),
      "Markdown 正文已复制"
    );

  return (
    <Card className="border-emerald-200/80 bg-emerald-50/30">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">公众号发布</CardTitle>
          <Badge variant="outline" className="bg-white">{theme.label}</Badge>
        </div>
        <p className="text-xs text-slate-600">
          预览确认后复制富文本，到微信后台粘贴正文；标题、摘要、封面另行填写。
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <WechatThemePicker layout={layout} onChange={onLayoutChange} />
        <PublishChecks checks={checks} />

        <div className="rounded-lg border bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
            <span className="text-xs font-medium text-slate-700">公众号预览</span>
            <div className="flex items-center gap-2">
              <div role="group" aria-label="预览宽度" className="flex rounded-md bg-slate-100 p-0.5">
                <Button size="sm" variant={previewWidth === "mobile" ? "outline" : "ghost"} aria-pressed={previewWidth === "mobile"} onClick={() => setPreviewWidth("mobile")}>手机</Button>
                <Button size="sm" variant={previewWidth === "wide" ? "outline" : "ghost"} aria-pressed={previewWidth === "wide"} onClick={() => setPreviewWidth("wide")}>宽屏</Button>
              </div>
              <Badge variant="outline" role="status">{previewLoading ? "渲染中…" : currentPreview?.error ? "检查未通过" : body.trim() ? "HTML 检查通过" : "待填写"}</Badge>
            </div>
          </div>
          <div className="max-h-[600px] overflow-auto bg-slate-100/80 p-2 sm:p-4" aria-busy={previewLoading}>
            {!body.trim() ? (
              <p className="text-sm text-slate-500">填写正文后显示预览</p>
            ) : currentPreview?.error ? (
              <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{currentPreview.error}</p>
            ) : previewLoading ? (
              <p className="py-8 text-center text-sm text-slate-500">正在排版…</p>
            ) : (
              <div
                className="wechat-preview mx-auto w-full bg-white shadow-sm"
                style={{ maxWidth: previewWidth === "mobile" ? 375 : 677 }}
                dangerouslySetInnerHTML={{ __html: currentPreview?.html ?? "" }}
              />
            )}
          </div>
        </div>
        <p className="text-xs leading-relaxed text-slate-500">
          {previewWidth === "mobile" ? "手机预览宽度 375px（窄屏自适应）。" : "宽屏预览宽度 677px（窄屏自适应）。"}
          复制后请在微信后台核对图片、表格与样式。
          {currentPreview?.warnings.join("；")}
        </p>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={copyLoading || !body.trim() || previewLoading || Boolean(currentPreview?.error)}
              title={
                !canCopyRichText && placeholderImages > 0
                  ? `还有 ${placeholderImages} 处待替换配图`
                  : undefined
              }
              onClick={() => void handleCopyRichText()}
            >
              {copyLoading ? "复制中…" : "复制公众号富文本"}
            </Button>
            <Button variant="outline" onClick={() => void handleCopyMeta()}>
              复制标题/摘要
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={exportLoading || !body.trim()}
                className={buttonVariants({ variant: "outline" })}
              >
                {exportLoading ? "导出中…" : "导出"}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem disabled={previewLoading || Boolean(currentPreview?.error)} onClick={() => void handleExportHtml()}>
                  排版 HTML（当前主题）
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleExportWord()}>
                  公众号发布包（Word + 图片）
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleExportZip()}>
                  Markdown 备份包
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleCopyMarkdown()}>
                  复制 Markdown
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="text-xs text-slate-500">主题应用于预览、富文本复制和 HTML 导出；Word 发布包保留原有排版。</p>
          {!canCopyRichText && placeholderImages > 0 ? (
            <p className="text-xs text-amber-800">
              {imageCheck?.hint ?? `还有 ${placeholderImages} 处待替换配图，替换后才能复制富文本`}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
