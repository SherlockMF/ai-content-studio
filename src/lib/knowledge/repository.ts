"use client";

import { rankKnowledgeChunks } from "@/lib/knowledge/search";
import {
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeReference,
} from "@/types/domain";

const DB_NAME = "ai-content-knowledge-base";
const DB_VERSION = 1;
const DOCUMENTS_STORE = "documents";
const CHUNKS_STORE = "chunks";

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB 操作失败"));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB 事务失败"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB 事务已取消"));
  });
}

function openKnowledgeDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("当前浏览器不支持本地知识库"));
  }
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DOCUMENTS_STORE)) {
        const documents = db.createObjectStore(DOCUMENTS_STORE, { keyPath: "id" });
        documents.createIndex("updatedAt", "updatedAt");
      }
      if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
        const chunks = db.createObjectStore(CHUNKS_STORE, { keyPath: "id" });
        chunks.createIndex("documentId", "documentId");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法打开本地知识库"));
  });
}

export async function listKnowledgeDocuments() {
  const db = await openKnowledgeDb();
  try {
    const transaction = db.transaction(DOCUMENTS_STORE, "readonly");
    const documents = await requestResult(
      transaction.objectStore(DOCUMENTS_STORE).getAll() as IDBRequest<KnowledgeDocument[]>
    );
    return documents.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } finally {
    db.close();
  }
}

export async function getKnowledgeChunks(documentId?: string) {
  const db = await openKnowledgeDb();
  try {
    const transaction = db.transaction(CHUNKS_STORE, "readonly");
    const store = transaction.objectStore(CHUNKS_STORE);
    const request = documentId
      ? store.index("documentId").getAll(IDBKeyRange.only(documentId))
      : store.getAll();
    const chunks = await requestResult(request as IDBRequest<KnowledgeChunk[]>);
    return chunks.sort((a, b) => a.order - b.order);
  } finally {
    db.close();
  }
}

export async function saveKnowledgeDocument(
  document: KnowledgeDocument,
  chunks: KnowledgeChunk[]
) {
  const db = await openKnowledgeDb();
  try {
    const transaction = db.transaction([DOCUMENTS_STORE, CHUNKS_STORE], "readwrite");
    transaction.objectStore(DOCUMENTS_STORE).put(document);
    const chunkStore = transaction.objectStore(CHUNKS_STORE);
    const existingKeys = await requestResult(
      chunkStore.index("documentId").getAllKeys(IDBKeyRange.only(document.id))
    );
    existingKeys.forEach((key) => chunkStore.delete(key));
    chunks.forEach((chunk) => chunkStore.put(chunk));
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function updateKnowledgeDocument(document: KnowledgeDocument) {
  const db = await openKnowledgeDb();
  try {
    const transaction = db.transaction(DOCUMENTS_STORE, "readwrite");
    transaction.objectStore(DOCUMENTS_STORE).put(document);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function deleteKnowledgeDocument(documentId: string) {
  const db = await openKnowledgeDb();
  try {
    const transaction = db.transaction([DOCUMENTS_STORE, CHUNKS_STORE], "readwrite");
    transaction.objectStore(DOCUMENTS_STORE).delete(documentId);
    const chunkStore = transaction.objectStore(CHUNKS_STORE);
    const keys = await requestResult(
      chunkStore.index("documentId").getAllKeys(IDBKeyRange.only(documentId))
    );
    keys.forEach((key) => chunkStore.delete(key));
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function setKnowledgeDocumentEnabled(documentId: string, enabled: boolean) {
  const documents = await listKnowledgeDocuments();
  const document = documents.find((item) => item.id === documentId);
  if (!document) throw new Error("未找到知识文档");
  await updateKnowledgeDocument({
    ...document,
    enabled,
    updatedAt: new Date().toISOString(),
  });
}

export async function searchKnowledgeReferences(query: string, limit = 8) {
  const [documents, chunks] = await Promise.all([
    listKnowledgeDocuments(),
    getKnowledgeChunks(),
  ]);
  return rankKnowledgeChunks(query, documents, chunks, limit);
}

export async function getKnowledgeReferencesByIds(chunkIds: string[]) {
  if (chunkIds.length === 0) return [] as KnowledgeReference[];
  const [documents, chunks] = await Promise.all([
    listKnowledgeDocuments(),
    getKnowledgeChunks(),
  ]);
  const documentMap = new Map(documents.map((document) => [document.id, document]));
  const requested = new Set(chunkIds);
  return chunks
    .filter((chunk) => requested.has(chunk.id))
    .flatMap((chunk) => {
      const document = documentMap.get(chunk.documentId);
      if (!document) return [];
      return [{
        chunkId: chunk.id,
        documentId: document.id,
        sourceTitle: document.title,
        content: chunk.content,
        score: 0,
      } satisfies KnowledgeReference];
    });
}
