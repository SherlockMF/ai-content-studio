"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Home, Lightbulb, Settings, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store/app-store";

const navItems = [
  { href: "/dashboard", label: "工作台", icon: Home },
  { href: "/topics", label: "选题", icon: Lightbulb },
  { href: "/content", label: "稿件", icon: ShieldCheck },
  { href: "/materials", label: "知识库", icon: FileText },
  { href: "/settings", label: "设置", icon: Settings },
];

export function AppShell({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { imageJobs, contentItems } = useAppStore();
  const runningImages = Object.entries(imageJobs).filter(([, job]) => job.running);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-4 p-4 md:grid-cols-[240px_1fr]">
        <aside className="rounded-xl border bg-white p-3 md:sticky md:top-4 md:h-[calc(100vh-2rem)]">
          <div className="mb-4 px-2 py-3">
            <p className="text-xs text-slate-500">AI 内容发布工作台</p>
            <p className="text-sm font-semibold">选题 · 出稿 · 排期</p>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    active && "bg-slate-900 text-white hover:bg-slate-900 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {runningImages.length > 0 ? <div className="mt-4 space-y-2 rounded-lg bg-sky-50 p-3 text-xs" aria-label="后台生图任务">
            <p className="font-medium">后台生图 · {runningImages.length} 篇</p>
            {runningImages.map(([id, job]) => {
              const item = contentItems.find(content => content.id === id);
              return <div key={id}><p className="font-medium">{item?.title ?? "原稿件"}</p><p className="mt-1 text-slate-500">{job.progress}</p></div>;
            })}
            <p className="text-slate-500">可以切换稿件；请保持此工作台页面打开。</p>
          </div> : null}
        </aside>
        <section className="rounded-xl border bg-white">
          <header className="flex items-center justify-between border-b px-6 py-4">
            <h1 className="text-lg font-semibold">{title}</h1>
            <div>{action}</div>
          </header>
          <main className="p-6">{children}</main>
        </section>
      </div>
    </div>
  );
}
