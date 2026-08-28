import {
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeReference,
} from "@/types/domain";

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function queryTerms(query: string) {
  const normalized = normalize(query);
  const terms = new Set<string>();
  for (const token of normalized.match(/[a-z0-9][a-z0-9+.#-]*|[\u3400-\u9fff]+/g) ?? []) {
    if (token.length >= 2) terms.add(token);
    if (/^[\u3400-\u9fff]+$/.test(token) && token.length > 4) {
      for (let index = 0; index < token.length - 1; index += 2) {
        terms.add(token.slice(index, index + 2));
      }
    }
  }
  return { normalized, terms: [...terms].slice(0, 32) };
}

export function rankKnowledgeChunks(
  query: string,
  documents: KnowledgeDocument[],
  chunks: KnowledgeChunk[],
  limit = 8
): KnowledgeReference[] {
  const { normalized: normalizedQuery, terms } = queryTerms(query);
  const documentMap = new Map(
    documents
      .filter((document) => document.enabled && document.status === "ready")
      .map((document) => [document.id, document])
  );

  const ranked = chunks.flatMap((chunk) => {
    const document = documentMap.get(chunk.documentId);
    if (!document) return [];
    const title = normalize(document.title);
    const tags = normalize(document.tags.join(" "));
    const content = normalize(chunk.content);
    let score = 0;

    if (normalizedQuery.length >= 3) {
      if (title.includes(normalizedQuery)) score += 30;
      if (tags.includes(normalizedQuery)) score += 20;
      if (content.includes(normalizedQuery)) score += 12;
    }
    for (const term of terms) {
      if (title.includes(term)) score += 8;
      if (tags.includes(term)) score += 6;
      if (content.includes(term)) score += 2;
    }
    if (!normalizedQuery) score = Math.max(1, 5 - chunk.order * 0.1);
    if (score <= 0) return [];

    return [{
      chunkId: chunk.id,
      documentId: document.id,
      sourceTitle: document.title,
      content: chunk.content,
      score,
    } satisfies KnowledgeReference];
  });

  const perDocument = new Map<string, number>();
  return ranked
    .sort((a, b) => b.score - a.score || a.sourceTitle.localeCompare(b.sourceTitle))
    .filter((reference) => {
      const count = perDocument.get(reference.documentId) ?? 0;
      if (count >= 2) return false;
      perDocument.set(reference.documentId, count + 1);
      return true;
    })
    .slice(0, Math.max(1, limit));
}
