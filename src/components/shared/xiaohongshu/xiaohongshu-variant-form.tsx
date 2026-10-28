"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CONTENT_STATUSES } from "@/lib/content-status";
import {
  XIAOHONGSHU_BODY_MAX_CHARS,
  XIAOHONGSHU_TITLE_MAX_CHARS,
  clampXiaohongshuBody,
  clampXiaohongshuTitle,
  countXiaohongshuChars,
} from "@/lib/xiaohongshu/limits";
import { extractHashtagsFromText } from "@/lib/xiaohongshu/note-body";
import type { ContentStatus, XiaohongshuTone, XiaohongshuVariant } from "@/types/domain";

function CharCounter({ label, text, max }: { label: string; text: string; max: number }) {
  const count = countXiaohongshuChars(text);
  return (
    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
      <span>{label}</span>
      <span className={count > max ? "text-rose-600" : undefined}>
        {count}/{max}
      </span>
    </div>
  );
}

export function XiaohongshuVariantForm({
  tone,
  variant,
  status,
  reviewing,
  onToneChange,
  onStatusChange,
  onVariantChange,
  onSave,
  onReview,
}: {
  tone: XiaohongshuTone;
  variant: XiaohongshuVariant;
  status: ContentStatus;
  reviewing: boolean;
  onToneChange: (tone: XiaohongshuTone) => void;
  onStatusChange: (status: ContentStatus) => void;
  onVariantChange: (patch: Partial<XiaohongshuVariant>) => void;
  onSave: () => void;
  onReview: () => void;
}) {
  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Tabs value={tone} onValueChange={(value) => onToneChange(value as XiaohongshuTone)}>
            <TabsList>
              <TabsTrigger value="professional">专业轻表达</TabsTrigger>
              <TabsTrigger value="social">强氛围版 ✨</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="w-full space-y-1 sm:w-48">
            <label className="text-sm">状态</label>
            <Select value={status} onValueChange={(value) => onStatusChange(value as ContentStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <CharCounter label="标题" text={variant.title} max={XIAOHONGSHU_TITLE_MAX_CHARS} />
          <Input
            value={variant.title}
            maxLength={XIAOHONGSHU_TITLE_MAX_CHARS}
            onChange={(event) => onVariantChange({ title: clampXiaohongshuTitle(event.target.value) })}
            placeholder="小红书标题（≤20 字）"
          />
        </div>
        <div className="space-y-1">
          <CharCounter label="正文" text={variant.body} max={XIAOHONGSHU_BODY_MAX_CHARS} />
          <Textarea
            value={variant.body}
            maxLength={XIAOHONGSHU_BODY_MAX_CHARS}
            onChange={(event) => {
              const body = clampXiaohongshuBody(event.target.value);
              onVariantChange({ body, cta: "", hashtags: extractHashtagsFromText(body) });
            }}
            rows={18}
            className="font-mono text-sm leading-relaxed"
            placeholder={"讲解正文 + 一句互动收尾 + 文末 #话题1 #话题2 …（≤1000 字，话题必须带 #）"}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onSave}>保存小红书稿件</Button>
          <Button variant="outline" disabled={reviewing} onClick={onReview}>
            {reviewing ? "质检中…" : "运行小红书质检"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
