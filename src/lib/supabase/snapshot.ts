import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AppState } from "@/lib/store/app-store";

const SNAPSHOT_ID = "00000000-0000-0000-0000-000000000001";

export async function pushSnapshotToSupabase(state: AppState) {
  const client = getSupabaseBrowserClient();
  const { error } = await client.from("workspace_snapshots").upsert({
    id: SNAPSHOT_ID,
    workspace_id: "00000000-0000-0000-0000-000000000001",
    payload: state,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function pullSnapshotFromSupabase() {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from("workspace_snapshots")
    .select("payload")
    .eq("id", SNAPSHOT_ID)
    .maybeSingle();
  if (error) throw error;
  return (data?.payload ?? null) as AppState | null;
}
