"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildWechatPublishBundle, buildWechatPublishClipboard } from "@/lib/export-wechat-docx";
import { buildArticleMarkdown, buildMarkdownZipBundle } from "@/lib/export-markdown-bundle";
import {
  buildWechatPublishChecks,
  copyWechatRichText,
  buildWechatPublishHtml,
} from "@/lib/markdown/wechat-publish";
import { WECHAT_THEMES, WechatThemeId } from "@/lib/markdown/wechat-theme";
import { FactDiffReport } from "@/lib/fact-diff";
import { cn } from "@/lib/utils";

interface WechatPublishPanelProps {
  title: string;
  digest: string;
  body: string;
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
  reviewScore,
  exportableLocalImages,
  placeholderImages,
  factDiff,
  factDiffAcknowledged,
}: WechatPublishPanelProps) {
  const [themeId, setThemeId] = useState<WechatThemeId>("tech-eval");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const checks = useMemo(
    () =>
      buildWechatPublishChecks({
        title,
        digest,
        body,
        reviewScore,
        factDiff,
        factDiffAcknowledged,
      }),
    [title, digest, body, reviewScore, factDiff, factDiffAcknowledged]
  );

  const imageCheck = checks.find((c) => c.id === "images");
  const canCopyRichText =
    Boolean(body.trim()) &&
    checks
      .filter((c) => c.id !== "digest" && c.id !== "review" && c.id !== "images")
      .every((c) => c.ok) &&
    placeholderImages === 0;

  const refreshPreview = useCallback(async () => {
    if (!body.trim()) {
      setPreviewHtml("");
      return;
    }
    setPreviewLoading(true);
    try {
      const html = await buildWechatPublishHtml({
        body,
        theme: themeId,
        embedImages: false,
        origin: window.location.origin,
      });
      setPreviewHtml(html);
    } catch {
      setPreviewHtml("<p>预览生成失败</p>");
    } finally {
      setPreviewLoading(false);
    }
  }, [body, themeId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshPreview();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [refreshPreview]);

  const handleCopyRichText = async () => {
    if (!body.trim()) {
      toast.error("请先填写正文");
      return;
    }
    if (placeholderImages > 0) {
      toast.error(`还有 ${placeholderImages} 处待替换配图，请先插入本地图片`);
      return;
    }
    const blocked = checks.find(
      (c) => !c.ok && c.id !== "digest" && c.id !== "review" && c.id !== "images"
    );
    if (blocked) {
      toast.error(blocked.hint || blocked.label);
      return;
    }
    setCopyLoading(true);
    try {
      await copyWechatRichText({ body, title, digest, theme: themeId });
      toast.success("已复制公众号富文本，到微信后台粘贴即可");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "复制失败");
    } finally {
      setCopyLoading(false);
    }
  };

  const handleCopyMeta = async () => {
    await navigator.clipboard.writeText(buildWechatPublishClipboard({ title, digest }));
    toast.success("标题与摘要已复制");
  };

  const handleExportWord = async () => {
    setExportLoading(true);
    try {
      const { blob, fileName, imageCount } = await buildWechatPublishBundle({
        title,
        digest,
        body,
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(`公众号发布包已下载：Word + ${imageCount} 张图片 + 标题和摘要`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "公众号发布包导出失败");
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportZip = async () => {
    setExportLoading(true);
    try {
      const { blob, fileName } = await buildMarkdownZipBundle({
        title,
        digest,
        body,
        includeTitle: false,
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
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

  const handleCopyMarkdown = async () => {
    const content = buildArticleMarkdown({
      title,
      digest,
      body,
      includeTitle: false,
    });
    await navigator.clipboard.writeText(content);
    toast.success("Markdown 正文已复制");
  };

  return (
    <Card className="border-emerald-200/80 bg-emerald-50/30">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">公众号发布</CardTitle>
          <Select value={themeId} onValueChange={(v) => setThemeId(v as WechatThemeId)}>
            <SelectTrigger className="h-8 w-[140px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WECHAT_THEMES.map((theme) => (
                <SelectItem key={theme.id} value={theme.id}>
                  {theme.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-slate-600">
          预览确认后复制富文本，到微信后台粘贴正文；标题、摘要、封面另行填写。
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {checks.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs",
                item.ok
                  ? "border-emerald-200 bg-white text-slate-700"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              )}
            >
              <span>{item.ok ? "✅" : "⚠️"}</span>
              <span>
                {item.label}
                {item.hint ? (
                  <span className="mt-0.5 block text-[11px] opacity-80">{item.hint}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>

        <div className="rounded-lg border bg-white">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-xs font-medium text-slate-700">公众号预览</span>
            {previewLoading ? (
              <Badge variant="secondary">渲染中…</Badge>
            ) : (
              <Badge variant="outline">所见即所粘贴</Badge>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto p-4">
            {!body.trim() ? (
              <p className="text-sm text-slate-500">填写正文后显示预览</p>
            ) : (
              <div
                className="wechat-preview mx-auto max-w-[580px]"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={copyLoading || !body.trim()}
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
