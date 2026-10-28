"use client";

import { Button } from "@/components/ui/button";
import { useStoreActions, useStoreHydrated, type AppState } from "@/lib/store/app-store";
import { toast } from "sonner";
import { useRef, useState } from "react";
import { mergeSnapshots } from "@/lib/store/merge-snapshots";
import { STORAGE_KEY } from "@/lib/store/hydrate";
import { downloadBlob } from "@/lib/client-actions";

function downloadBackup(raw: string) {
  downloadBlob(
    new Blob([raw], { type: "application/json" }),
    `workbench-${location.hostname}-${location.port}-${Date.now()}.json`
  );
}

export function LocalDataBackup() {
  const storeHydrated = useStoreHydrated();
  const { replaceState, getSnapshot } = useStoreActions();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pasted, setPasted] = useState("");
  const applyBackup = (text: string) => {
    try {
      const incoming = JSON.parse(text);
      if (!incoming.publishVoice || !["topics", "materials", "contentItems", "reviews", "versions"].every((key) => Array.isArray(incoming[key]) && incoming[key].every((item: { id?: unknown }) => item && typeof item.id === "string"))) {
        throw new Error("不是有效的工作台数据备份");
      }
      if (!storeHydrated) throw new Error("请等待本地数据加载完成");
      const raw = JSON.stringify(getSnapshot());
      const result = mergeSnapshots(JSON.parse(raw) as AppState, incoming as AppState);
      downloadBackup(raw);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result.state));
      replaceState(result.state);
      setPasted("");
      toast.success(`合并完成：新增 ${result.added} 篇，${result.conflicts} 处差异已选用较新版`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "合并失败"); }
  };
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={!storeHydrated} onClick={() => {
        downloadBackup(JSON.stringify(getSnapshot()));
        toast.success("稿件数据已备份（不含 API Key，图片文件保留在项目目录）");
      }}>备份本地稿件数据</Button>
      <Button variant="outline" disabled={!storeHydrated} onClick={() => fileInput.current?.click()}>合并其他端口备份</Button>
    </div>
    <p className="text-xs">相同稿件保留较新版，旧版不重复导入；合并前自动下载当前备份。</p>
    <details>
      <summary className="cursor-pointer text-xs">也可粘贴备份内容</summary>
      <textarea aria-label="备份 JSON" className="mt-2 w-full rounded border p-2" value={pasted} onChange={(event) => setPasted(event.target.value)} />
      <Button variant="outline" disabled={!storeHydrated || !pasted.trim()} onClick={() => applyBackup(pasted)}>合并粘贴的备份</Button>
    </details>
    <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" onChange={async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try { applyBackup(await file.text()); }
      catch (error) { toast.error(error instanceof Error ? error.message : "读取备份失败"); }
    }} />
  </div>;
}
