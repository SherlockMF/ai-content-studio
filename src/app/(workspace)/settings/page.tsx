"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/shared/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_LLM_SETTINGS,
  LLM_MODEL_OPTIONS,
  LLMClientSettings,
  LLMModelId,
  loadLLMSettings,
  normalizeLLMSettings,
  saveLLMSettings,
} from "@/lib/ai/llm-settings";
import {
  PUBLISH_VOICE_PRESETS,
  applyPublishVoicePreset,
  findPublishVoicePreset,
} from "@/lib/publish-voice-presets";
import { useAppStore } from "@/lib/store/app-store";
import { pullSnapshotFromSupabase, pushSnapshotToSupabase } from "@/lib/supabase/snapshot";

export default function SettingsPage() {
  const { publishVoice, updatePublishVoice, replaceState, ...rest } = useAppStore();
  const [loading, setLoading] = useState<null | "push" | "pull">(null);
  const [llmSettings, setLlmSettings] = useState<LLMClientSettings>(DEFAULT_LLM_SETTINGS);
  const [llmHydrated, setLlmHydrated] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState(
    () => findPublishVoicePreset(publishVoice).id
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage hydration
    setLlmSettings(loadLLMSettings());
    setLlmHydrated(true);
  }, []);
  const selectedPreset =
    PUBLISH_VOICE_PRESETS.find((item) => item.id === selectedPresetId) ??
    PUBLISH_VOICE_PRESETS[0];

  const onModelChange = (model: LLMModelId) => {
    const option = LLM_MODEL_OPTIONS.find((item) => item.value === model);
    setLlmSettings((prev) =>
      normalizeLLMSettings({
        ...prev,
        model,
        provider: option?.provider ?? prev.provider,
      })
    );
  };

  return (
    <AppShell title="设置">
      <div className="space-y-4" id="voice">
        <Card id="llm">
          <CardHeader>
            <CardTitle>模型调用设置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm">模型</label>
              <select
                className="h-9 w-full rounded-lg border px-3 text-sm"
                value={llmSettings.model}
                disabled={!llmHydrated}
                onChange={(e) => onModelChange(e.target.value as LLMModelId)}
              >
                {LLM_MODEL_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">默认预选 DeepSeek V4 Flash（deepseek-v4-flash）。已取消 Mock，所有生成走真实模型。</p>
            </div>
            <div className="space-y-1">
              <label className="text-sm">API Base URL</label>
              <Input
                value={llmSettings.baseUrl}
                onChange={(e) =>
                  setLlmSettings((prev) => ({ ...prev, baseUrl: e.target.value }))
                }
                placeholder="https://api.deepseek.com"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm">API Key</label>
                <button
                  type="button"
                  className="text-xs text-slate-500 underline"
                  onClick={() => setShowKey((v) => !v)}
                >
                  {showKey ? "隐藏" : "显示"}
                </button>
              </div>
              <Input
                type={showKey ? "text" : "password"}
                value={llmSettings.apiKey}
                onChange={(e) =>
                  setLlmSettings((prev) => ({ ...prev, apiKey: e.target.value }))
                }
                placeholder="在此填写 DeepSeek API Key"
                autoComplete="off"
              />
              <p className="text-xs text-slate-500">
                Key 仅保存在本机浏览器 localStorage，不会写入 Supabase 快照。调用选题/稿件/质检/去 AI 味时会发给本站服务端用于请求模型。
              </p>
            </div>
            <Button
              type="button"
              className="w-fit"
              onClick={() => {
                const next = normalizeLLMSettings(llmSettings);
                if (!next.apiKey.trim()) {
                  toast.error("请填写 DeepSeek API Key");
                  return;
                }
                saveLLMSettings(next);
                setLlmSettings(next);
                toast.success(`已保存：${next.model}`);
              }}
            >
              保存模型设置
            </Button>
          </CardContent>
        </Card>

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
            <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-600">
              <p className="font-medium text-slate-900">{selectedPreset.voice.accountName}</p>
              <p className="mt-1">{selectedPreset.voice.voice}</p>
              <p className="mt-2 text-xs text-slate-500">
                受众：{selectedPreset.voice.audience}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                板块：{selectedPreset.voice.defaultSections.join("、")}
              </p>
            </div>
            <Button
              type="button"
              className="w-fit"
              onClick={() => {
                updatePublishVoice(applyPublishVoicePreset(selectedPreset, publishVoice));
                toast.success(`已切换为「${selectedPreset.label}」`);
              }}
            >
              保存人设
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>系统说明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>1. 业务数据默认保存在本机；可选用 Supabase 快照同步（不含 API Key）。</p>
            <p>2. 模型调用使用本页 DeepSeek 配置；也可用环境变量 DEEPSEEK_API_KEY 兜底。已取消 Mock。</p>
            <p>3. 选题页内嵌热点研究 → 三方向 → 出稿；人设来自设置页预设。</p>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                disabled={loading !== null}
                onClick={async () => {
                  try {
                    setLoading("push");
                    await pushSnapshotToSupabase({
                      publishVoice,
                      materials: rest.materials,
                      topics: rest.topics,
                      contentItems: rest.contentItems,
                      reviews: rest.reviews,
                      versions: rest.versions,
                    });
                    toast.success("已推送到 Supabase");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "推送失败");
                  } finally {
                    setLoading(null);
                  }
                }}
              >
                {loading === "push" ? "推送中..." : "推送本地数据到 Supabase"}
              </Button>
              <Button
                disabled={loading !== null}
                onClick={async () => {
                  try {
                    setLoading("pull");
                    const snapshot = await pullSnapshotFromSupabase();
                    if (!snapshot) {
                      toast.message("Supabase 暂无快照数据");
                      return;
                    }
                    replaceState(snapshot);
                    toast.success("已从 Supabase 拉取并覆盖本地数据");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "拉取失败");
                  } finally {
                    setLoading(null);
                  }
                }}
              >
                {loading === "pull" ? "拉取中..." : "从 Supabase 拉取数据"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
