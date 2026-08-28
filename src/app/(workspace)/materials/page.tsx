"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Database, FileText, Loader2, Pencil, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/shared/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { extractKnowledgeFile, KNOWLEDGE_DOC_ACCEPT } from "@/lib/extract-document-text";
import { chunkKnowledgeText } from "@/lib/knowledge/chunk-document";
import {
  deleteKnowledgeDocument,
  listKnowledgeDocuments,
  saveKnowledgeDocument,
  setKnowledgeDocumentEnabled,
} from "@/lib/knowledge/repository";
import { useAppStore } from "@/lib/store/app-store";
import { KnowledgeDocument, MaterialItem, MaterialType } from "@/types/domain";

const MATERIAL_TYPES: MaterialType[] = ["观点", "案例", "素材片段", "常用表达", "禁止表达"];

function makeId(prefix: string) {
  return `${prefix}_${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now()}`;
}

function fileExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension ? `.${extension}` : "";
}

function titleFromFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || fileName;
}

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

export default function MaterialsPage() {
  const { materials, upsertMaterial, toggleMaterial, deleteMaterial } = useAppStore();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ready" | "failed" | "disabled">("all");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [materialTitle, setMaterialTitle] = useState("");
  const [materialBody, setMaterialBody] = useState("");
  const [materialType, setMaterialType] = useState<MaterialType>("观点");
  const [materialTags, setMaterialTags] = useState("");
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [materialFilter, setMaterialFilter] = useState<MaterialType | "全部">("全部");
  const [materialQuery, setMaterialQuery] = useState("");

  const refreshDocuments = useCallback(async () => {
    try {
      const next = await listKnowledgeDocuments();
      setDocuments(next);
      setSelectedDocumentId((current) =>
        current && next.some((item) => item.id === current) ? current : next[0]?.id ?? null
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "无法读取本地知识库");
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  useEffect(() => {
    // IndexedDB 是外部数据源，页面挂载后需要异步恢复文档列表。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshDocuments();
  }, [refreshDocuments]);

  const uploadFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setUploadingCount((count) => count + files.length);
    for (const file of files) {
      const id = makeId("knowledge");
      const now = new Date().toISOString();
      const base: KnowledgeDocument = {
        id,
        workspaceId: "ws_demo",
        title: titleFromFileName(file.name),
        fileName: file.name,
        extension: fileExtension(file.name),
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        extractedText: "",
        tags: [],
        enabled: true,
        status: "processing",
        chunkCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      try {
        await saveKnowledgeDocument(base, []);
        await refreshDocuments();
        const extractedText = (await extractKnowledgeFile(file)).trim();
        if (!extractedText) throw new Error("文件中没有可提取的文字");
        const chunks = chunkKnowledgeText(extractedText, id, base.workspaceId);
        await saveKnowledgeDocument({
          ...base,
          extractedText,
          status: "ready",
          chunkCount: chunks.length,
          updatedAt: new Date().toISOString(),
        }, chunks);
        toast.success(`${file.name} 已加入知识库`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "解析失败";
        await saveKnowledgeDocument({
          ...base,
          status: "failed",
          error: message,
          updatedAt: new Date().toISOString(),
        }, []);
        toast.error(`${file.name}：${message}`);
      } finally {
        setUploadingCount((count) => Math.max(0, count - 1));
        await refreshDocuments();
      }
    }
  }, [refreshDocuments]);

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    await uploadFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    await uploadFiles(Array.from(event.dataTransfer.files));
  };

  const visibleDocuments = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return documents.filter((document) => {
      if (statusFilter === "ready" && document.status !== "ready") return false;
      if (statusFilter === "failed" && document.status !== "failed") return false;
      if (statusFilter === "disabled" && document.enabled) return false;
      if (!normalized) return true;
      return [document.title, document.fileName, document.tags.join(" "), document.extractedText]
        .some((value) => value.toLocaleLowerCase().includes(normalized));
    });
  }, [documents, query, statusFilter]);

  const selectedDocument = documents.find((item) => item.id === selectedDocumentId) ?? null;

  const resetMaterialForm = () => {
    setEditingMaterialId(null);
    setMaterialTitle("");
    setMaterialBody("");
    setMaterialType("观点");
    setMaterialTags("");
  };

  const editMaterial = (item: MaterialItem) => {
    setEditingMaterialId(item.id);
    setMaterialTitle(item.title);
    setMaterialBody(item.body);
    setMaterialType(item.type);
    setMaterialTags(item.tags.join("，"));
  };

  const saveMaterial = () => {
    if (!materialTitle.trim() || !materialBody.trim()) {
      toast.error("请填写标题和正文");
      return;
    }
    const existing = materials.find((item) => item.id === editingMaterialId);
    const now = new Date().toISOString();
    upsertMaterial({
      id: existing?.id ?? makeId("material"),
      workspaceId: existing?.workspaceId ?? "ws_demo",
      title: materialTitle.trim(),
      body: materialBody.trim(),
      type: materialType,
      tags: materialTags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
      enabled: existing?.enabled ?? true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    toast.success(existing ? "知识条目已更新" : "知识条目已添加");
    resetMaterialForm();
  };

  const visibleMaterials = materials.filter((item) => {
    if (materialFilter !== "全部" && item.type !== materialFilter) return false;
    const normalized = materialQuery.trim().toLocaleLowerCase();
    return !normalized || [item.title, item.body, item.tags.join(" ")]
      .some((value) => value.toLocaleLowerCase().includes(normalized));
  });

  return (
    <AppShell title="知识库">
      <Tabs defaultValue="documents" className="gap-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">让每次创作都有资料可查</h2>
            <p className="mt-1 text-sm text-muted-foreground">上传笔记并自动切分；生成前由系统推荐，你可以确认实际使用的片段。</p>
          </div>
          <TabsList>
            <TabsTrigger value="documents"><Database />资料文档</TabsTrigger>
            <TabsTrigger value="items"><FileText />知识条目</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="documents" className="space-y-4">
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
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="h-8 rounded-lg border bg-background px-3 text-sm">
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
                        <Switch checked={selectedDocument.enabled} onCheckedChange={async (enabled) => {
                          await setKnowledgeDocumentEnabled(selectedDocument.id, enabled);
                          await refreshDocuments();
                          toast.success(enabled ? "文档已启用" : "文档已停用");
                        }} />
                        <Button variant="destructive" size="icon-sm" title="删除文档" onClick={async () => {
                          if (!window.confirm(`确定删除“${selectedDocument.title}”吗？`)) return;
                          await deleteKnowledgeDocument(selectedDocument.id);
                          await refreshDocuments();
                          toast.success("文档已删除");
                        }}><Trash2 /></Button>
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
        </TabsContent>

        <TabsContent value="items">
          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <Card>
              <CardHeader><CardTitle>{editingMaterialId ? "编辑知识条目" : "新增知识条目"}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input value={materialTitle} onChange={(event) => setMaterialTitle(event.target.value)} placeholder="标题" />
                <Textarea value={materialBody} onChange={(event) => setMaterialBody(event.target.value)} placeholder="正文" className="min-h-32" />
                <select className="h-8 w-full rounded-lg border bg-background px-3 text-sm" value={materialType} onChange={(event) => setMaterialType(event.target.value as MaterialType)}>{MATERIAL_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                <Input value={materialTags} onChange={(event) => setMaterialTags(event.target.value)} placeholder="标签，用逗号分隔" />
                <div className="flex gap-2"><Button onClick={saveMaterial}>{editingMaterialId ? "保存修改" : "添加条目"}</Button>{editingMaterialId ? <Button variant="outline" onClick={resetMaterialForm}>取消</Button> : null}</div>
              </CardContent>
            </Card>
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={materialQuery} onChange={(event) => setMaterialQuery(event.target.value)} placeholder="搜索知识条目" className="pl-9" /></div>
                <select className="h-8 rounded-lg border bg-background px-3 text-sm" value={materialFilter} onChange={(event) => setMaterialFilter(event.target.value as MaterialType | "全部")}><option value="全部">全部类型</option>{MATERIAL_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
              </div>
              {visibleMaterials.length === 0 ? (
                <Card><CardContent className="py-16 text-center text-muted-foreground">没有符合条件的知识条目</CardContent></Card>
              ) : visibleMaterials.map((item) => (
                <Card key={item.id}>
                  <CardHeader className="flex-row items-start justify-between space-y-0">
                    <div className="min-w-0"><CardTitle className="truncate text-base">{item.title}</CardTitle><div className="mt-2 flex flex-wrap gap-1"><Badge variant="secondary">{item.type}</Badge>{item.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div></div>
                    <div className="flex items-center gap-1">
                      <Switch checked={item.enabled} onCheckedChange={() => toggleMaterial(item.id)} />
                      <Button variant="ghost" size="icon-sm" title="编辑" onClick={() => editMaterial(item)}><Pencil /></Button>
                      <Button variant="ghost" size="icon-sm" title="删除" onClick={() => {
                        if (!window.confirm(`确定删除“${item.title}”吗？`)) return;
                        deleteMaterial(item.id);
                        if (editingMaterialId === item.id) resetMaterialForm();
                        toast.success("知识条目已删除");
                      }}><Trash2 /></Button>
                    </div>
                  </CardHeader>
                  <CardContent className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.body}</CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
