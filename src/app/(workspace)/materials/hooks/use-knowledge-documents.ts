"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { extractKnowledgeFile } from "@/lib/extract-document-text";
import { chunkKnowledgeText } from "@/lib/knowledge/chunk-document";
import {
  deleteKnowledgeDocument,
  listKnowledgeDocuments,
  saveKnowledgeDocument,
  setKnowledgeDocumentEnabled,
} from "@/lib/knowledge/repository";
import type { KnowledgeDocument } from "@/types/domain";
import { makeMaterialId } from "./material-ids";

export type DocumentStatusFilter = "all" | "ready" | "failed" | "disabled";

function fileExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension ? `.${extension}` : "";
}

function titleFromFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || fileName;
}

export function useKnowledgeDocuments() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DocumentStatusFilter>("all");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

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
      const id = makeMaterialId("knowledge");
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

  const setDocumentEnabled = async (document: KnowledgeDocument, enabled: boolean) => {
    await setKnowledgeDocumentEnabled(document.id, enabled);
    await refreshDocuments();
    toast.success(enabled ? "文档已启用" : "文档已停用");
  };

  const removeDocument = async (document: KnowledgeDocument) => {
    if (!window.confirm(`确定删除“${document.title}”吗？`)) return;
    await deleteKnowledgeDocument(document.id);
    await refreshDocuments();
    toast.success("文档已删除");
  };

  return {
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
    setDocumentEnabled,
    removeDocument,
  };
}

export type KnowledgeDocumentsState = ReturnType<typeof useKnowledgeDocuments>;
