import { ContentItem, ImportBaseline } from "@/types/domain";

export function createImportBaseline(item: Pick<ContentItem, "title" | "body" | "digest" | "coverCopy" | "cta">): ImportBaseline {
  return {
    title: item.title,
    body: item.body,
    digest: item.digest,
    coverCopy: item.coverCopy,
    cta: item.cta,
    savedAt: new Date().toISOString(),
  };
}

export function hasImportBaseline(item: Pick<ContentItem, "importBaseline"> | null | undefined) {
  return Boolean(item?.importBaseline?.body?.trim());
}
