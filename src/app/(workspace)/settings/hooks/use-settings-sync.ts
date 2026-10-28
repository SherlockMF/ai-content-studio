"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useContentState, useStoreActions, useWorkspaceState } from "@/lib/store/app-store";
import { pullSnapshotFromSupabase, pushSnapshotToSupabase } from "@/lib/supabase/snapshot";

export function useSettingsSync() {
  const { publishVoice, materials, topics } = useWorkspaceState();
  const { contentItems, reviews, versions } = useContentState();
  const { replaceState } = useStoreActions();
  const [loading, setLoading] = useState<null | "push" | "pull">(null);

  const push = async () => {
    try {
      setLoading("push");
      await pushSnapshotToSupabase({ publishVoice, materials, topics, contentItems, reviews, versions });
      toast.success("已推送到 Supabase");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "推送失败");
    } finally {
      setLoading(null);
    }
  };

  const pull = async () => {
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
  };

  return { loading, push, pull };
}
