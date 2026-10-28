"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LLM_MODEL_OPTIONS, type LLMModelId } from "@/lib/ai/llm-settings";
import { IMAGE_GEN_MODEL_OPTIONS, type ImageGenModelId } from "@/lib/ai/image-settings";
import type { ModelSettingsState } from "../hooks/use-model-settings";

function SecretInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <div className="flex items-center justify-between">
        <label className="text-sm">{label}</label>
        <button type="button" className="text-xs text-slate-500 underline" onClick={() => setVisible((v) => !v)}>
          {visible ? "隐藏" : "显示"}
        </button>
      </div>
      <Input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
    </>
  );
}

export function LlmSettingsCard({ settings }: { settings: ModelSettingsState }) {
  const { llmSettings } = settings;
  return (
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
            disabled={!settings.hydrated}
            onChange={(e) => settings.changeLlmModel(e.target.value as LLMModelId)}
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
            onChange={(e) => settings.patchLlm({ baseUrl: e.target.value })}
            placeholder="https://api.deepseek.com"
          />
        </div>
        <div className="space-y-1">
          <SecretInput
            label="API Key"
            value={llmSettings.apiKey}
            placeholder="在此填写 DeepSeek API Key"
            onChange={(apiKey) => settings.patchLlm({ apiKey })}
          />
          <p className="text-xs text-slate-500">
            优先读取项目根目录 `.env.local` 的 `DEEPSEEK_API_KEY`（改后需重启开发服务）。未配置本地文件时，才使用本页保存的 Key（仅本机
            localStorage，不会写入 Supabase）。调用选题/稿件/质检/去 AI 味时会发给本站服务端用于请求模型。
          </p>
        </div>
        <Button type="button" className="w-fit" onClick={settings.saveLlm}>
          保存模型设置
        </Button>
      </CardContent>
    </Card>
  );
}

export function ImageGenSettingsCard({ settings }: { settings: ModelSettingsState }) {
  const { imageSettings } = settings;
  return (
    <Card id="image-gen">
      <CardHeader>
        <CardTitle>生图模型</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm">模型</label>
          <select
            className="h-9 w-full rounded-lg border px-3 text-sm"
            value={imageSettings.model}
            disabled={!settings.hydrated}
            onChange={(e) => settings.changeImageModel(e.target.value as ImageGenModelId)}
          >
            {IMAGE_GEN_MODEL_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            推荐 Qwen-Image 3.0（文字排版更适合图文笔记）。免费额度文生图目前主要是 wanx-v1，效果偏氛围时请用 Qwen。
          </p>
        </div>
        <div className="space-y-1">
          <label className="text-sm">API Base URL</label>
          <Input
            value={imageSettings.baseUrl}
            onChange={(e) => settings.patchImage({ baseUrl: e.target.value })}
            placeholder="https://dashscope.aliyuncs.com"
          />
        </div>
        <div className="space-y-1">
          <SecretInput
            label="DashScope API Key"
            value={imageSettings.apiKey}
            placeholder="在此填写 DashScope API Key"
            onChange={(apiKey) => settings.patchImage({ apiKey })}
          />
          <p className="text-xs text-slate-500">
            优先读取 `.env.local` 的 `DASHSCOPE_API_KEY`（改后需重启开发服务）。未配置时使用本页
            Key（仅本机 localStorage，不进 Supabase）。
          </p>
        </div>
        <Button type="button" className="w-fit" onClick={settings.saveImage}>
          保存生图设置
        </Button>
      </CardContent>
    </Card>
  );
}
