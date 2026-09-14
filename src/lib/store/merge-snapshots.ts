import type { AppState } from "./app-store";

export function mergeSnapshots(current: AppState, incoming: AppState) {
  const mergeById = <T extends { id: string }>(a: T[], b: T[]) => {
    const items = new Map(b.map((item) => [item.id, item]));
    a.forEach((item) => items.set(item.id, item));
    return [...items.values()];
  };
  const selectedIncoming = new Set<string>();
  let conflicts = 0;
  const contentItems = mergeById(current.contentItems, incoming.contentItems);
  for (let index = 0; index < contentItems.length; index++) {
    const a = current.contentItems.find((item) => item.id === contentItems[index].id);
    const b = incoming.contentItems.find((item) => item.id === contentItems[index].id);
    if (!b) continue;
    if (!a || Date.parse(b.updatedAt) > Date.parse(a.updatedAt)) {
      contentItems[index] = b;
      selectedIncoming.add(b.id);
    }
    if (a && JSON.stringify(a) !== JSON.stringify(b)) conflicts++;
  }
  return {
    state: { ...current, contentItems,
      versions: mergeById(current.versions, incoming.versions.filter((v) => selectedIncoming.has(v.contentItemId))),
      topics: mergeById(current.topics, incoming.topics),
      materials: mergeById(current.materials, incoming.materials),
      reviews: mergeById(current.reviews, incoming.reviews.filter((v) => selectedIncoming.has(v.contentItemId))),
    },
    added: contentItems.length - current.contentItems.length,
    conflicts,
  };
}
