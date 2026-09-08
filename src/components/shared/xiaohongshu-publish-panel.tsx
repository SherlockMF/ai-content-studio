"use client";

import { useState } from "react";
import { Copy, Download, ImageIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildXiaohongshuBodyCopyText,
  buildXiaohongshuNoteText,
  buildXiaohongshuPromptText,
  buildXiaohongshuPublishChecks,
  buildXiaohongshuPublishBundle,
} from "@/lib/xiaohongshu/publish";
import { countMissingXiaohongshuImages } from "@/lib/xiaohongshu/generate-images";
import { cn } from "@/lib/utils";
import type {
  ContentReview,
  XiaohongshuDraftData,
  XiaohongshuImagePrompt,
  XiaohongshuTone,
} from "@/types/domain";

interface XiaohongshuPublishPanelProps {
  data: XiaohongshuDraftData;
  tone: XiaohongshuTone;
  sourceTitle?: string;
  review?: ContentReview;
  onReplanImagePrompts: () => Promise<void>;
  onGenerateImages: (onlyMissing: boolean) => Promise<void>;
  onImportLocalImages: () => Promise<void>;
  imageRegenerating: boolean;
  imageRendering: boolean;
  imageProgress?: string;
}

const ROLE_LABELS: Record<XiaohongshuImagePrompt["role"], string> = {
  cover: "封面",
  content: "正文",
  ending: "收尾",
};

export function XiaohongshuPublishPanel({
  data,
  tone,
  sourceTitle,
  review,
  onReplanImagePrompts,
  onGenerateImages,
  onImportLocalImages,
  imageRegenerating,
  imageRendering,
  imageProgress,
}: XiaohongshuPublishPanelProps) {
  const [exporting, setExporting] = useState(false);
  const variant = data.variants[tone];
  const checks = buildXiaohongshuPublishChecks({ data, tone, review });
  const canCopyFullNote = checks.every((check) => !check.blocking || check.ok);
  const missingCount = countMissingXiaohongshuImages(data.imagePlan);
  const coverImage = data.imagePlan.find((item) => item.imageUrl)?.imageUrl;
  const busy = imageRegenerating || imageRendering || exporting;

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "复制失败，请检查剪贴板权限");
    }
  };

  const downloadBundle = async () => {
    if (busy) return;
    setExporting(true);
    let objectUrl: string | undefined;

    try {
      const { blob, fileName } = await buildXiaohongshuPublishBundle(data, tone, sourceTitle);
      objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.click();
      toast.success("小红书发布包已下载");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导出失败，请稍后重试");
    } finally {
      if (objectUrl) {
        const url = objectUrl;
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setExporting(false);
    }
  };

  const replan = async () => {
    try {
      await onReplanImagePrompts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "图片规划失败，请稍后重试");
    }
  };

  const generate = async (onlyMissing: boolean) => {
    try {
      await onGenerateImages(onlyMissing);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "配图生成失败，请稍后重试");
    }
  };

  const importLocal = async () => {
    try {
      await onImportLocalImages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导入本地配图失败");
    }
  };

  return (
    <Card className="border-rose-200/80 bg-rose-50/30">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">小红书发布</CardTitle>
          <Badge variant="outline" className="border-rose-200 bg-white text-rose-700">
            {tone === "professional" ? "专业轻表达" : "强氛围版 ✨"}
          </Badge>
        </div>
        <p className="text-xs text-slate-600">
          网页里的配图存在稿件数据中；命令行生成的图在 output/ 目录，需点「导入本地配图」才会出现在这里。也可直接「生成配图」在线重跑。
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {checks.map((check) => (
            <li
              key={check.id}
              className={cn(
                "flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs",
                check.ok
                  ? "border-emerald-200 bg-white text-slate-700"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              )}
            >
              <span aria-hidden>{check.ok ? "✅" : "⚠️"}</span>
              <span>
                {check.label}
                {check.hint ? (
                  <span className="mt-0.5 block text-[11px] opacity-80">{check.hint}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>

        <section className="rounded-xl border bg-white p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-xs font-medium text-slate-700">手机预览</h3>
            <Badge variant="secondary">3:4 图文笔记</Badge>
          </div>
          <article className="mx-auto min-h-80 max-w-[390px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            {coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverImage}
                alt="小红书封面预览"
                className="aspect-[3/4] w-full object-cover"
              />
            ) : null}
            <div className="px-5 py-6">
              {variant.title.trim() || variant.body.trim() ? (
                <>
                  <h4 className="text-lg font-semibold leading-7 text-slate-950">
                    {variant.title || "未填写标题"}
                  </h4>
                  <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {variant.body || "未填写正文（含文末 #话题）"}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">填写标题和正文后显示预览</p>
              )}
            </div>
          </article>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium text-slate-900">配图</h3>
              <p className="mt-0.5 text-xs text-slate-500">{data.visualDirection}</p>
              {imageProgress ? (
                <p className="mt-1 text-xs text-rose-700">{imageProgress}</p>
              ) : missingCount > 0 ? (
                <p className="mt-1 text-xs text-amber-700">
                  还有 {missingCount} 张未生成，可点「生成配图」补全
                </p>
              ) : (
                <p className="mt-1 text-xs text-emerald-700">配图已齐</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {missingCount > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void importLocal()}
                >
                  导入本地配图
                </Button>
              ) : null}
              <Button
                variant="default"
                size="sm"
                disabled={busy}
                onClick={() => void generate(missingCount > 0)}
              >
                <ImageIcon data-icon="inline-start" />
                {imageRendering
                  ? "处理中…"
                  : missingCount > 0
                    ? "生成配图"
                    : "重新生成配图"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  void copyText(buildXiaohongshuPromptText(data), "全部生图提示词已复制")
                }
              >
                <Copy data-icon="inline-start" />
                复制提示词
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void replan()}
              >
                <RefreshCw
                  data-icon="inline-start"
                  className={cn(imageRegenerating && "animate-spin")}
                />
                {imageRegenerating ? "规划中…" : "重规划提示词"}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {data.imagePlan.map((image) => (
              <Card key={`${image.index}-${image.role}`} size="sm" className="bg-white">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm">
                      图 {image.index} · {ROLE_LABELS[image.role]}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() =>
                        void copyText(
                          buildXiaohongshuPromptText({
                            visualDirection: data.visualDirection,
                            imagePlan: [image],
                          }),
                          `图 ${image.index} 提示词已复制`
                        )
                      }
                    >
                      <Copy data-icon="inline-start" />
                      复制
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs leading-5 text-slate-600">
                  {image.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image.imageUrl}
                      alt={`图 ${image.index} ${image.overlayText}`}
                      className="aspect-[3/4] w-full rounded-lg border object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[3/4] w-full items-center justify-center rounded-lg border border-dashed bg-slate-50 px-3 text-center text-slate-500">
                      {image.imageError
                        ? `生成失败：${image.imageError}`
                        : "尚未生成配图"}
                    </div>
                  )}
                  <p>
                    <span className="font-medium text-slate-800">画面职责：</span>
                    {image.objective}
                  </p>
                  <p>
                    <span className="font-medium text-slate-800">图中文字：</span>
                    {image.overlayText}
                  </p>
                  <p>
                    <span className="font-medium text-slate-800">构图：</span>
                    {image.composition}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!canCopyFullNote}
            onClick={() =>
              void copyText(buildXiaohongshuBodyCopyText(variant), "正文已复制（含 #话题）")
            }
          >
            <Copy data-icon="inline-start" />
            复制正文
          </Button>
          <Button
            variant="outline"
            disabled={!variant.title.trim()}
            onClick={() => void copyText(variant.title.trim(), "标题已复制")}
          >
            <Copy data-icon="inline-start" />
            复制标题
          </Button>
          <Button
            variant="outline"
            disabled={!canCopyFullNote}
            onClick={() =>
              void copyText(buildXiaohongshuNoteText(variant), "标题+正文已复制")
            }
          >
            复制标题+正文
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void downloadBundle()}>
            <Download data-icon="inline-start" />
            {exporting ? "打包中…" : "导出发布包（ZIP）"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
