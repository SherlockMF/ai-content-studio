"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PUBLISH_VOICE_PRESETS,
  applyPublishVoicePreset,
  findPublishVoicePreset,
} from "@/lib/publish-voice-presets";
import { useStoreActions, useStoreHydrated, useWorkspaceState } from "@/lib/store/app-store";
import type { PublishVoice } from "@/types/domain";

export function PublishVoiceCard() {
  const { publishVoice } = useWorkspaceState();
  const hydrated = useStoreHydrated();
  if (!hydrated) return <Card><CardHeader><CardTitle>发布人设</CardTitle></CardHeader><CardContent>正在加载人设设置…</CardContent></Card>;
  return <PublishVoiceForm key={JSON.stringify(publishVoice)} initialVoice={publishVoice} />;
}

function PublishVoiceForm({ initialVoice }: { initialVoice: PublishVoice }) {
  const { updatePublishVoice } = useStoreActions();
  const [voice, setVoice] = useState(initialVoice);
  const [selectedPresetId, setSelectedPresetId] = useState(() => findPublishVoicePreset(initialVoice).id);
  const selectedPreset =
    PUBLISH_VOICE_PRESETS.find((item) => item.id === selectedPresetId) ?? PUBLISH_VOICE_PRESETS[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>发布人设</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm">人设类型</label>
          <select
            className="h-9 w-full rounded-lg border px-3 text-sm"
            value={selectedPresetId}
            onChange={(e) => setSelectedPresetId(e.target.value)}
          >
            {PUBLISH_VOICE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">{selectedPreset.summary}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setVoice(current => applyPublishVoicePreset(selectedPreset, current))}>应用预设</Button>
        <p className="text-xs text-slate-500">应用预设会替换下方风格信息，保留公众号名称；点击保存后生效。</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm"><span>公众号名称</span><Input value={voice.accountName} onChange={event => setVoice(current => ({ ...current, accountName: event.target.value }))} placeholder="填写公众号名称" /></label>
          <label className="space-y-1 text-sm"><span>创作者定位</span><Input value={voice.voice} onChange={event => setVoice(current => ({ ...current, voice: event.target.value }))} /></label>
          <label className="space-y-1 text-sm"><span>目标读者</span><Textarea value={voice.audience} onChange={event => setVoice(current => ({ ...current, audience: event.target.value }))} rows={2} /></label>
          <label className="space-y-1 text-sm"><span>表达风格</span><Textarea value={voice.style} onChange={event => setVoice(current => ({ ...current, style: event.target.value }))} rows={2} /></label>
          <label className="space-y-1 text-sm"><span>避免使用的表达</span><Textarea value={voice.bannedExpressions} onChange={event => setVoice(current => ({ ...current, bannedExpressions: event.target.value }))} rows={2} /></label>
          <label className="space-y-1 text-sm"><span>结尾与互动要求</span><Textarea value={voice.conversionNote ?? ""} onChange={event => setVoice(current => ({ ...current, conversionNote: event.target.value }))} rows={2} placeholder="例如：不添加关注引导" /></label>
        </div>
        <p className="text-xs text-slate-500">这些信息用于后续生成，已有稿件不会自动改写。默认板块：{voice.defaultSections.join("、")}</p>
        <Button
          type="button"
          className="w-fit"
          onClick={() => {
            if (!voice.accountName.trim()) { toast.error("请填写公众号名称"); return; }
            updatePublishVoice({ ...voice, accountName: voice.accountName.trim() });
            toast.success("发布人设已保存");
          }}
        >
          保存人设
        </Button>
      </CardContent>
    </Card>
  );
}
