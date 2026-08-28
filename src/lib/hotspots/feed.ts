import { HotspotFeedEntry, HOTSPOT_FETCH_TIMEOUT_MS } from "@/lib/hotspots/types";

function stripCdata(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("<![CDATA[")) return trimmed;
  return trimmed.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block: string, tag: string) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = regex.exec(block);
  if (!match?.[1]) return undefined;
  return stripHtml(stripCdata(match[1]));
}

function parseBlocks(xml: string, tag: "item" | "entry") {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const blocks: string[] = [];
  let match = regex.exec(xml);
  while (match) {
    blocks.push(match[1]);
    match = regex.exec(xml);
  }
  return blocks;
}

function entryUrl(block: string) {
  const linkTag = extractTag(block, "link");
  if (linkTag && linkTag.startsWith("http")) return linkTag;
  const hrefMatch = /<link[^>]+href=["']([^"']+)["']/i.exec(block);
  return hrefMatch?.[1];
}

export function parseFeedXml(xml: string): HotspotFeedEntry[] {
  const blocks = [...parseBlocks(xml, "item"), ...parseBlocks(xml, "entry")];
  const entries: HotspotFeedEntry[] = [];

  for (const block of blocks) {
    const title = extractTag(block, "title");
    const url = entryUrl(block);
    if (!title || !url) continue;
    const summary =
      extractTag(block, "description") ||
      extractTag(block, "summary") ||
      extractTag(block, "content");
    const publishedAt =
      extractTag(block, "pubDate") || extractTag(block, "published") || extractTag(block, "updated");
    entries.push({
      title,
      url,
      ...(summary ? { summary: summary.slice(0, 400) } : {}),
      ...(publishedAt ? { publishedAt } : {}),
    });
  }

  return entries;
}

export async function fetchFeedEntries(url: string): Promise<HotspotFeedEntry[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HOTSPOT_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        "User-Agent": "zuzhijinhua-hotspot-bot/1.0",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const xml = await response.text();
    if (xml.trim().startsWith("<!DOCTYPE") || xml.trim().startsWith("<html")) {
      throw new Error("返回 HTML 而非 RSS");
    }
    return parseFeedXml(xml);
  } finally {
    clearTimeout(timer);
  }
}
