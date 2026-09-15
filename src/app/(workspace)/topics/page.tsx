"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AppShell } from "@/components/shared/app-shell";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { TopicWorkbench } from "@/components/shared/topic-workbench";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/store/app-store";
import { formatScheduleLabel } from "@/lib/schedule";
import { topicsWithoutWechatDraft } from "@/lib/workspace-lists";

export default function TopicsPage() {
  const { topics, contentItems, deleteTopic, scheduleContent } = useAppStore();
  const [error, setError] = useState<string | null>(null);
  const poolTopics = topicsWithoutWechatDraft(topics, contentItems);

  return (
    <AppShell title="选题">
      {error ? <ErrorState message={error} /> : null}
      <TopicWorkbench />
      {poolTopics.length === 0 ? (
        <EmptyState
          title="选题池为空"
          description="这里只放还没出稿的选题。已有稿件请去「稿件」页；热点研究生成后会自动进入选题池。"
        />
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {poolTopics.map((topic) => (
            <Card key={topic.id}>
              <CardHeader>
                <CardTitle className="text-base">{topic.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-slate-600">
                <p>核心观点：{topic.coreViewpoint}</p>
                <p>内容板块：{topic.section}</p>
                {topic.hotspotTitle ? <p>关联热点：{topic.hotspotTitle}</p> : null}
                <p>平台：公众号</p>
                {topic.suggestedScheduledAt ? <div className="rounded-md bg-sky-50 p-2 text-sky-900">
                  <p>预排：{formatScheduleLabel(topic.suggestedScheduledAt)}</p>
                  <p className="text-xs">{topic.scheduleReason}</p>
                </div> : null}
              </CardContent>
              <CardFooter className="justify-end gap-2">
                <Link
                  href={`/content?topicId=${topic.id}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  去写稿
                </Link>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    try {
                      const scheduledAt = scheduleContent({
                        id: `content_topic_${topic.id}_${Date.now()}`,
                        workspaceId: "ws_demo",
                        topicId: topic.id,
                        platform: "wechat",
                        source: "imported",
                        title: topic.title,
                        body: "",
                        digest: "",
                        coverCopy: "",
                        status: "编辑中",
                        publishedAt: null,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                      });
                      toast.success(`已加入排期 ${scheduledAt.slice(0, 10)}`);
                    } catch (err) {
                      const message = err instanceof Error ? err.message : "排期失败";
                      setError(message);
                      toast.error(message);
                    }
                  }}
                >
                  加入排期
                </Button>
                <Button variant="outline" size="sm" onClick={() => deleteTopic(topic.id)}>
                  删除
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
