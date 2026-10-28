"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  DEFAULT_LLM_SETTINGS,
  LLM_MODEL_OPTIONS,
  type LLMClientSettings,
  type LLMModelId,
  loadLLMSettings,
  normalizeLLMSettings,
  saveLLMSettings,
} from "@/lib/ai/llm-settings";
import {
  DEFAULT_IMAGE_GEN_SETTINGS,
  type ImageGenModelId,
  type ImageGenSettings,
  loadImageGenSettings,
  normalizeImageGenSettings,
  saveImageGenSettings,
} from "@/lib/ai/image-settings";

/** 模型与生图设置只保存在本机 localStorage */
export function useModelSettings() {
  const [llmSettings, setLlmSettings] = useState<LLMClientSettings>(DEFAULT_LLM_SETTINGS);
  const [imageSettings, setImageSettings] = useState<ImageGenSettings>(DEFAULT_IMAGE_GEN_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage hydration
    setLlmSettings(loadLLMSettings());
    setImageSettings(loadImageGenSettings());
    setHydrated(true);
  }, []);

  const changeLlmModel = (model: LLMModelId) => {
    const option = LLM_MODEL_OPTIONS.find((item) => item.value === model);
    setLlmSettings((prev) =>
      normalizeLLMSettings({ ...prev, model, provider: option?.provider ?? prev.provider })
    );
  };

  const patchLlm = (patch: Partial<LLMClientSettings>) =>
    setLlmSettings((prev) => ({ ...prev, ...patch }));

  const saveLlm = () => {
    const next = normalizeLLMSettings(llmSettings);
    if (!next.apiKey.trim()) {
      toast.error("请填写 DeepSeek API Key");
      return;
    }
    saveLLMSettings(next);
    setLlmSettings(next);
    toast.success(`已保存：${next.model}`);
  };

  const changeImageModel = (model: ImageGenModelId) => {
    setImageSettings((prev) => normalizeImageGenSettings({ ...prev, model }));
  };

  const patchImage = (patch: Partial<ImageGenSettings>) =>
    setImageSettings((prev) => ({ ...prev, ...patch }));

  const saveImage = () => {
    const next = normalizeImageGenSettings(imageSettings);
    if (!next.apiKey.trim()) {
      toast.error("请填写 DashScope API Key");
      return;
    }
    saveImageGenSettings(next);
    setImageSettings(next);
    toast.success(`已保存生图模型：${next.model}`);
  };

  return {
    hydrated,
    llmSettings,
    changeLlmModel,
    patchLlm,
    saveLlm,
    imageSettings,
    changeImageModel,
    patchImage,
    saveImage,
  };
}

export type ModelSettingsState = ReturnType<typeof useModelSettings>;
