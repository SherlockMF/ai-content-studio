"use client";

import { AppShell } from "@/components/shared/app-shell";
import { LocalDataBackup } from "@/components/shared/local-data-backup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageGenSettingsCard, LlmSettingsCard } from "./components/model-settings-cards";
import { PublishVoiceCard } from "./components/publish-voice-card";
import { useModelSettings } from "./hooks/use-model-settings";
import { useSettingsSync } from "./hooks/use-settings-sync";

export default function SettingsPage() {
  const modelSettings = useModelSettings();
  const sync = useSettingsSync();

  return (
    <AppShell title="设置">
      <div className="space-y-4" id="voice">
        <LlmSettingsCard settings={modelSettings} />
        <ImageGenSettingsCard settings={modelSettings} />
        <PublishVoiceCard />

        <Card>
          <CardHeader>
            <CardTitle>系统说明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>1. 业务数据默认保存在本机；可选用 Supabase 快照同步（不含 API Key）。</p>
            <p>2. 模型调用优先使用 `.env.local` 的 DEEPSEEK_API_KEY；未配置时才用本页浏览器 Key。已取消 Mock。</p>
            <p>3. 选题页内嵌热点研究 → 三方向 → 出稿；人设来自设置页保存的信息。</p>
            <div className="flex gap-2 pt-2">
              <LocalDataBackup />
              <Button variant="outline" disabled={sync.loading !== null} onClick={sync.push}>
                {sync.loading === "push" ? "推送中..." : "推送本地数据到 Supabase"}
              </Button>
              <Button disabled={sync.loading !== null} onClick={sync.pull}>
                {sync.loading === "pull" ? "拉取中..." : "从 Supabase 拉取数据"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
