"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  importMarkdownFolder,
  importMarkdownZip,
  ImportedMarkdownProject,
} from "@/lib/import-markdown-project";

interface MarkdownImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importRaw: string;
  onImportRawChange: (value: string) => void;
  onImportText: () => void;
  onImportProject: (project: ImportedMarkdownProject) => void;
}

export function MarkdownImportDialog({
  open,
  onOpenChange,
  importRaw,
  onImportRawChange,
  onImportText,
  onImportProject,
}: MarkdownImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>导入 Markdown 草稿</DialogTitle>
          <DialogDescription>
            支持粘贴 Markdown，或导入 <strong>ZIP / 文件夹</strong>（含{" "}
            <code>article.md</code> + <code>assets/</code> 图片）。导入后标记为「已有草稿」，并保存原始快照。
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={importRaw}
          onChange={(e) => onImportRawChange(e.target.value)}
          rows={10}
          placeholder={"# 文章标题\n\n> 一两句摘要\n\n正文..."}
          className="font-mono text-sm"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,.txt"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const text = await file.text();
            onImportRawChange(text);
            event.target.value = "";
          }}
        />
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setLoading(true);
            try {
              onImportProject(await importMarkdownZip(file));
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "ZIP 导入失败");
            } finally {
              setLoading(false);
              event.target.value = "";
            }
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          className="hidden"
          multiple
          // @ts-expect-error webkitdirectory for folder picker
          webkitdirectory=""
          directory=""
          onChange={async (event) => {
            const files = event.target.files;
            if (!files?.length) return;
            setLoading(true);
            try {
              onImportProject(await importMarkdownFolder(files));
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "文件夹导入失败");
            } finally {
              setLoading(false);
              event.target.value = "";
            }
          }}
        />
        <p className="text-xs text-slate-500">
          文件夹导入：选择含 <code>公众号版.md</code> 和 <code>images/</code> 的整个目录。
        </p>
        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              选择 .md
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => zipInputRef.current?.click()}
            >
              {loading ? "导入中…" : "导入 ZIP 项目"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => folderInputRef.current?.click()}
            >
              导入文件夹
            </Button>
          </div>
          <Button type="button" onClick={onImportText} disabled={loading}>
            导入并保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
