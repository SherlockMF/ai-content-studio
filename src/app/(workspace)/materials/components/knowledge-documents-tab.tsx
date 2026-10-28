"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Database, Loader2, Search, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { KNOWLEDGE_DOC_ACCEPT } from "@/lib/extract-document-text";
import type { KnowledgeDocument } from "@/types/domain";
import type { DocumentStatusFilter, KnowledgeDocumentsState } from "../hooks/use-knowledge-documents";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function DocumentStatus({ document }: { document: KnowledgeDocument }) {
  if (document.status === "processing") {
    return <Badge variant="secondary"><Loader2 className="animate-spin" />解析中</Badge>;
  }
  if (document.status === "failed") {
    return <Badge variant="destructive"><AlertCircle />解析失败</Badge>;
  }
  return <Badge variant="secondary"><CheckCircle2 />已就绪</Badge>;
}

export function KnowledgeDocumentsTab({ state }: { state: KnowledgeDocumentsState }) {
  const {
    documents,
    documentsLoading,
    uploadingCount,
    query,
    setQuery,
    statusFilter,
    setStatusFilter,
    selectedDocumentId,
    setSelectedDocumentId,
    selectedDocument,
    visibleDocuments,
    uploadFiles,
  } = state;
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    await uploadFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    await uploadFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <>
      <input ref={fileInputRef} type="file" accept={KNOWLEDGE_DOC_ACCEPT} multiple className="hidden" onChange={onFileChange} />
      <div
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors ${dragging ? "border-primary bg-muted" : "bg-muted/30"}`}
      >
        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-background shadow-sm">
          {uploadingCount > 0 ? <Loader2 className="animate-spin" /> : <Upload />}
        </div>
        <p className="font-medium">拖入笔记文件，或选择文件上传</p>
        <p className="mt-1 text-xs text-muted-foreground">支持 MD、TXT、DOCX、PDF，可多选，单个不超过 10 MB</p>
        <Button className="mt-4" disabled={uploadingCount > 0} onClick={() => fileInputRef.current?.click()}>
          <Upload />{uploadingCount > 0 ? `正在处理 ${uploadingCount} 个文件` : "选择文件"}
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、标签或正文" className="pl-9" />
        </div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as DocumentStatusFilter)} className="h-8 rounded-lg border bg-background px-3 text-sm">
          <option value="all">全部状态</option><option value="ready">已就绪</option><option value="failed">解析失败</option><option value="disabled">已停用</option>
        </select>
      </div>

      <div className="grid min-h-[460px] gap-4 lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.4fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b py-3"><CardTitle className="flex items-center justify-between text-sm"><span>全部文档</span><span className="font-normal text-muted-foreground">{visibleDocuments.length} 个</span></CardTitle></CardHeader>
          <CardContent className="max-h-[560px] space-y-1 overflow-y-auto p-2">
            {documentsLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="animate-spin" />读取中</div>
            ) : visibleDocuments.length === 0 ? (
              <div className="px-4 py-16 text-center text-muted-foreground">{documents.length === 0 ? "还没有资料，先上传一份笔记" : "没有符合条件的文档"}</div>
            ) : visibleDocuments.map((document) => (
              <button type="button" key={document.id} onClick={() => setSelectedDocumentId(document.id)} className={`w-full rounded-lg p-3 text-left transition-colors ${selectedDocumentId === document.id ? "bg-muted" : "hover:bg-muted/60"}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-xs font-semibold uppercase">{document.extension.replace(".", "") || "TXT"}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{document.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><DocumentStatus document={document} /><span>{formatBytes(document.size)}</span><span>·</span><span>{formatDate(document.updatedAt)}</span></div>
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          {selectedDocument ? (
            <>
              <CardHeader className="border-b">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0"><CardTitle className="truncate text-base">{selectedDocument.title}</CardTitle><p className="mt-1 truncate text-xs text-muted-foreground">{selectedDocument.fileName}</p></div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch checked={selectedDocument.enabled} onCheckedChange={(enabled) => state.setDocumentEnabled(selectedDocument, enabled)} />
                    <Button variant="destructive" size="icon-sm" title="删除文档" onClick={() => state.removeDocument(selectedDocument)}><Trash2 /></Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2 text-xs text-muted-foreground"><DocumentStatus document={selectedDocument} /><Badge variant="outline">{selectedDocument.chunkCount} 个片段</Badge><Badge variant="outline">{selectedDocument.extractedText.length.toLocaleString()} 字</Badge></div>
              </CardHeader>
              <CardContent className="max-h-[470px] overflow-y-auto p-5">
                {selectedDocument.status === "failed" ? (
                  <div className="rounded-lg bg-destructive/10 p-4 text-destructive">{selectedDocument.error || "解析失败"}</div>
                ) : selectedDocument.status === "processing" ? (
                  <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground"><Loader2 className="animate-spin" />正在解析文档</div>
                ) : (
                  <div className="whitespace-pre-wrap text-sm leading-7 text-foreground/80">{selectedDocument.extractedText}</div>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="flex min-h-[460px] flex-col items-center justify-center text-center text-muted-foreground"><Database className="mb-3 size-8" /><p>选择左侧文档查看内容</p></CardContent>
          )}
        </Card>
      </div>
    </>
  );
}
