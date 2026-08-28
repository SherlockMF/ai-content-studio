import { HotspotSnapshot, HOTSPOT_CACHE_TTL_MS } from "@/lib/hotspots/types";

let cachedSnapshot: HotspotSnapshot | null = null;

export function readHotspotSnapshot(now = Date.now()) {
  if (!cachedSnapshot) return { snapshot: null, stale: false, expired: true };
  const expired = Date.parse(cachedSnapshot.expiresAt) <= now;
  return { snapshot: cachedSnapshot, stale: expired, expired };
}

export function writeHotspotSnapshot(snapshot: HotspotSnapshot) {
  cachedSnapshot = snapshot;
}

export function createSnapshotId(now = new Date()) {
  return `hotspot-${now.getTime()}`;
}

export function createSnapshotExpiry(now = Date.now()) {
  return new Date(now + HOTSPOT_CACHE_TTL_MS).toISOString();
}
