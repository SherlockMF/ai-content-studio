"use client";

import Link from "next/link";
import { AppShell } from "@/components/shared/app-shell";
import { ScheduleBoard } from "@/components/shared/schedule-board";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { useAppStore } from "@/lib/store/app-store";

export default function DashboardPage() {
  const { contentItems } = useAppStore();
  const pendingConfirm = contentItems.filter((i) => i.status === "待确认");
  const pendingPublish = contentItems.filter((i) => i.status === "待发布");
  const editing = contentItems.filter((i) =>
    ["AI 草稿", "编辑中", "待质检"].includes(i.status)
  );

  return (
    <AppShell
      title="工作台"
      action={
        <div className="flex gap-2">
          <Link href="/topics" className={buttonVariants({ variant: "outline" })}>
            新建选题
          </Link>
          <Link href="/content" className={buttonVariants({ variant: "default" })}>
            写公众号稿
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">排期（每周五）</h2>
          <ScheduleBoard />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">待确认</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-2xl font-semibold">{pendingConfirm.length}</p>
              {pendingConfirm.slice(0, 3).map((item) => (
                <p key={item.id} className="truncate text-slate-600">
                  {item.title}
                </p>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">待发布</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-2xl font-semibold">{pendingPublish.length}</p>
              {pendingPublish.slice(0, 3).map((item) => (
                <p key={item.id} className="truncate text-slate-600">
                  {item.title}
                </p>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">创作中</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-2xl font-semibold">{editing.length}</p>
              {editing.slice(0, 3).map((item) => (
                <p key={item.id} className="truncate text-slate-600">
                  {item.title}
                </p>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
