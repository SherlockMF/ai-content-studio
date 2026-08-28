import { HotspotSourceConfig } from "@/lib/hotspots/types";

/** 公开 RSS 源；单源失效不影响整体。 */
export const AI_HOTSPOT_SOURCES: HotspotSourceConfig[] = [
  {
    id: "ithome",
    name: "IT之家",
    url: "https://www.ithome.com/rss/",
    enabled: true,
  },
  {
    id: "sspai",
    name: "少数派",
    url: "https://sspai.com/feed",
    enabled: true,
  },
  {
    id: "geekpark",
    name: "极客公园",
    url: "https://www.geekpark.net/rss",
    enabled: true,
  },
  {
    id: "solidot",
    name: "Solidot",
    url: "https://www.solidot.org/index.rss",
    enabled: true,
  },
  {
    id: "qbitai",
    name: "量子位",
    url: "https://www.qbitai.com/feed",
    enabled: true,
  },
  {
    id: "huxiu",
    name: "虎嗅",
    url: "https://www.huxiu.com/rss/0.xml",
    enabled: false,
  },
];
