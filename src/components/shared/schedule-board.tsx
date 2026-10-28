"use client";

import { AutoSchedulePanel } from "@/components/shared/schedule/auto-schedule-panel";
import { ScheduleEditSheet, useScheduleEditor } from "@/components/shared/schedule/schedule-edit-sheet";
import { ScheduleHeatmap } from "@/components/shared/schedule/schedule-heatmap";
import { useContentState, useStoreActions, useStoreHydrated, useWorkspaceState } from "@/lib/store/app-store";

export function ScheduleBoard() {
  const { contentItems, autoScheduleEnabled } = useContentState();
  const { topics } = useWorkspaceState();
  const storeHydrated = useStoreHydrated();
  const { setAutoScheduleEnabled, replanSchedule } = useStoreActions();
  const editor = useScheduleEditor();

  return (
    <div className="space-y-3">
      <AutoSchedulePanel
        contentItems={contentItems}
        topics={topics}
        storeHydrated={storeHydrated}
        autoScheduleEnabled={Boolean(autoScheduleEnabled)}
        onAutoScheduleChange={setAutoScheduleEnabled}
        onReplan={replanSchedule}
      />
      <ScheduleHeatmap contentItems={contentItems} onOpenItem={editor.openItem} />
      <ScheduleEditSheet editor={editor} />
    </div>
  );
}
