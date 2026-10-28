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
import { copyNotePreservingLines } from "@/lib/xiaohongshu/clipboard";
import { cn } from "@/lib/utils";
import { PublishChecks } from "@/components/shared/publish-checks";
import { copyWithToast, downloadBlob } from "@/lib/client-actions";
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
  const missingCount = countMissingXiaohongshuImages(data.imagePlan);
  const coverImage = data.imagePlan.find((item) => item.imageUrl)?.imageUrl;
  const busy = imageRegenerating || imageRendering || exporting;

  const copyText = async (text: string, successMessage: string, preserveLines = false) => {
    if (!preserveLines) {
      await copyWithToast(text, successMessage);
      return;
    }
    try {
      await copyNotePreservingLines(text);
      toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "复制失败，请检查剪贴板权限");
    }
  };

  const downloadBundle = async () => {
    if (busy) return;
    setExporting(true);
    try {
      const { blob, fileName } = await buildXiaohongshuPublishBundle(data, tone, sourceTitle);
      downloadBlob(blob, fileName);
      toast.success("小红书发布包已下载");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导出失败，请稍后重试");
    } finally {
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
        <PublishChecks checks={checks} />

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

        <p className="text-xs text-slate-600">粘贴到小红书时，使用下方「复制正文（保留换行）」，标题单独复制到标题栏。不要从 Markdown 预览全选复制；离线可使用发布包里的「正文.txt」。若目标编辑器仍改变格式，可尝试 Ctrl+Shift+V 粘贴为纯文本。复制不代表已通过质检。</p>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!variant.body.trim()}
            onClick={() =>
              void copyText(buildXiaohongshuBodyCopyText(variant), "正文已复制，已保留换行和空行", true)
            }
          >
            <Copy data-icon="inline-start" />
            复制正文（保留换行）
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
            disabled={!variant.body.trim()}
            onClick={() =>
              void copyText(buildXiaohongshuNoteText(variant), "标题+正文已复制，已保留换行和空行", true)
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
