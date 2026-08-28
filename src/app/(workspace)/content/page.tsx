"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/shared/app-shell";
import { ContentEditor } from "@/app/(workspace)/content/content-editor";

function ContentPageInner() {
  const searchParams = useSearchParams();
  const topicId = searchParams.get("topicId");
  return <ContentEditor key={topicId ?? "default"} initialTopicId={topicId} />;
}

export default function ContentPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="稿件 · 公众号图文">
          <p className="text-sm text-slate-500">加载中...</p>
        </AppShell>
      }
    >
      <ContentPageInner />
    </Suspense>
  );
}
