"use client";

import { Pencil, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { MaterialType } from "@/types/domain";
import { MATERIAL_TYPES, type MaterialFormState } from "../hooks/use-material-form";

export function MaterialItemsTab({ form }: { form: MaterialFormState }) {
  const { fields, editingId } = form;

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader><CardTitle>{editingId ? "编辑知识条目" : "新增知识条目"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input value={fields.title} onChange={(event) => form.setTitle(event.target.value)} placeholder="标题" />
          <Textarea value={fields.body} onChange={(event) => form.setBody(event.target.value)} placeholder="正文" className="min-h-32" />
          <select className="h-8 w-full rounded-lg border bg-background px-3 text-sm" value={fields.type} onChange={(event) => form.setType(event.target.value as MaterialType)}>{MATERIAL_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <Input value={fields.tags} onChange={(event) => form.setTags(event.target.value)} placeholder="标签，用逗号分隔" />
          <div className="flex gap-2"><Button onClick={form.save}>{editingId ? "保存修改" : "添加条目"}</Button>{editingId ? <Button variant="outline" onClick={form.reset}>取消</Button> : null}</div>
        </CardContent>
      </Card>
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={form.query} onChange={(event) => form.setQuery(event.target.value)} placeholder="搜索知识条目" className="pl-9" /></div>
          <select className="h-8 rounded-lg border bg-background px-3 text-sm" value={form.filter} onChange={(event) => form.setFilter(event.target.value as MaterialType | "全部")}><option value="全部">全部类型</option>{MATERIAL_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        </div>
        {form.visibleMaterials.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">没有符合条件的知识条目</CardContent></Card>
        ) : form.visibleMaterials.map((item) => (
          <Card key={item.id}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div className="min-w-0"><CardTitle className="truncate text-base">{item.title}</CardTitle><div className="mt-2 flex flex-wrap gap-1"><Badge variant="secondary">{item.type}</Badge>{item.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div></div>
              <div className="flex items-center gap-1">
                <Switch checked={item.enabled} onCheckedChange={() => form.toggle(item.id)} />
                <Button variant="ghost" size="icon-sm" title="编辑" onClick={() => form.edit(item)}><Pencil /></Button>
                <Button variant="ghost" size="icon-sm" title="删除" onClick={() => form.remove(item)}><Trash2 /></Button>
              </div>
            </CardHeader>
            <CardContent className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.body}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
