"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadArticleImage } from "@/lib/api-client";
import { formatIllustrationButtonHint } from "@/lib/content-media-status";
import { extractArticleSlots } from "@/lib/illustrations/article-slots";
import type { CoverImageVariant } from "@/lib/illustrations/cover";
import type { ContentMedia } from "../hooks/use-content-media";

export function WechatEditorActions({
  placement,
  title,
  body,
  hasTopic,
  media,
  reviewLoading,
  mediaLoading,
  onSave,
  onInsertSnippet,
  onApplyCoverVariant,
  onRunReview,
}: {
  placement: "main" | "extra" | "images";
  title: string;
  body: string;
  hasTopic: boolean;
  media: ContentMedia;
  reviewLoading: boolean;
  mediaLoading: boolean;
  onSave: () => void;
  onInsertSnippet: (snippet: string) => void;
  onApplyCoverVariant: (variant: CoverImageVariant) => void;
  onRunReview: () => void;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const illustrationHint = useMemo(() => formatIllustrationButtonHint(body), [body]);
  const hintSuffix = illustrationHint ? ` ${illustrationHint}` : "";
  const hasSlots = useMemo(() => extractArticleSlots(body).length > 0, [body]);

  const insertImage = async (file: File) => {
    setImageUploadLoading(true);
    try {
      const url = await uploadArticleImage(file);
      const alt = file.name.replace(/\.[^.]+$/i, "") || "配图";
      onInsertSnippet(`\n![${alt}](${url})\n`);
      toast.success("图片已插入正文，导出 Markdown 包时会一并打包");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "图片上传失败");
    } finally {
      setImageUploadLoading(false);
    }
  };

  const generateCoverPrompt = async () => {
    if (!hasTopic) {
      toast.error("请先选择选题");
      return;
    }
    const variant = await media.analyzeCover({ force: true });
    if (variant) onApplyCoverVariant(variant);
  };

  return (
    <>
      {placement === "extra" && <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          await insertImage(file);
          event.target.value = "";
        }}
      />}

      <div className="flex flex-wrap items-center gap-2">
        {placement === "extra" && <Button type="button" variant="outline" size="sm" onClick={onSave}>
          立即保存
        </Button>}
        {placement === "main" && <Button
          variant="outline"
          size="sm"
          disabled={!body.trim() || media.illustrationLoading}
          onClick={() => { if (hasSlots) document.getElementById("article-image-slots")?.scrollIntoView({ behavior: "smooth", block: "start" }); else void media.analyzeIllustrations(); }}
        >
          {media.illustrationLoading
            ? "分析中..."
            : hasSlots ? `查看正文配图${hintSuffix}` : media.hasIllustrationCache
              ? `查看配图建议${hintSuffix}`
              : `识别正文配图${hintSuffix}`}
        </Button>}
        {placement === "images" && hasSlots && <Button variant="outline" size="sm" disabled={media.illustrationLoading} onClick={() => void media.analyzeIllustrations({ force: true })}>AI 推荐新配图</Button>}
        {(placement === "images" || (placement === "extra" && !hasSlots)) && <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={media.coverLoading || (!title.trim() && !body.trim())}
          onClick={() => void generateCoverPrompt()}
        >
          {media.coverLoading
            ? "生成中..."
            : media.hasCoverCache
              ? "更新封面提示词"
              : "生成封面提示词"}
        </Button>}
        {placement === "extra" && <Button
          variant="outline"
          size="sm"
          disabled={imageUploadLoading}
          onClick={() => imageInputRef.current?.click()}
        >
          {imageUploadLoading ? "上传中..." : "在正文当前位置新增图片"}
        </Button>}
        {placement === "main" && <Button
          variant="outline"
          size="sm"
          disabled={!body.trim() || reviewLoading || mediaLoading}
          title="仅检查稿件，不修改正文；发布前检查还会处理去 AI 味和配图"
          onClick={onRunReview}
        >
          {reviewLoading ? "质检中..." : "运行质检"}
        </Button>}
      </div>
      {placement === "main" && <p className="text-xs text-slate-500">运行质检仅检查稿件；发布前检查还会处理去 AI 味和配图。</p>}
    </>
  );
}
