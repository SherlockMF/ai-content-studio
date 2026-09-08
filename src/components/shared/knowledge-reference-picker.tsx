"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, RefreshCw, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { searchKnowledgeReferences } from "@/lib/knowledge/repository";
import { KnowledgeReference } from "@/types/domain";

export function KnowledgeReferencePicker({
  query,
  value,
  onChange,
  compact = false,
}: {
  query: string;
  value: KnowledgeReference[];
  onChange: (value: KnowledgeReference[]) => void;
  /** 收进折叠区时用更矮的一行样式 */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<KnowledgeReference[]>([]);
  const [loading, setLoading] = useState(false);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  }, [value, onChange]);

  const load = useCallback(async (input: string, autoSelect: boolean) => {
    setLoading(true);
    try {
      const results = await searchKnowledgeReferences(input, 12);
      setCandidates(results);
      if (autoSelect && valueRef.current.length === 0 && results.length > 0) {
        onChangeRef.current(results.slice(0, 4));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // IndexedDB 检索是外部数据源；选题变化时异步刷新推荐。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(query, true);
  }, [load, query]);

  const allCandidates = [...value, ...candidates].filter(
    (item, index, list) => list.findIndex((candidate) => candidate.chunkId === item.chunkId) === index
  );

  const toggle = (reference: KnowledgeReference, checked: boolean) => {
    if (checked) {
      onChange([...value, reference].filter(
        (item, index, list) => list.findIndex((candidate) => candidate.chunkId === item.chunkId) === index
      ).slice(0, 8));
      return;
    }
    onChange(value.filter((item) => item.chunkId !== reference.chunkId));
  };

  return (
    <Card className={compact ? "border-dashed shadow-none" : "border-dashed"}>
      <CardHeader
        className={
          compact
            ? "flex-row items-center justify-between space-y-0 px-3 py-2"
            : "flex-row items-center justify-between space-y-0 py-3"
        }
      >
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <BookOpen />
            本次参考资料
            {value.length > 0 ? (
              <Badge variant="secondary" className="text-[10px]">
                {value.length}
              </Badge>
            ) : null}
          </CardTitle>
          {compact ? null : (
            <p className="mt-1 text-xs text-muted-foreground">
              系统自动推荐，你可以在生成前增删确认。
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          {loading ? <Loader2 className="animate-spin" /> : <Search />}
          {value.length ? `管理 ${value.length} 条` : "选择资料"}
        </Button>
      </CardHeader>
      {!compact && value.length > 0 ? (
        <CardContent className="flex flex-wrap gap-2 pt-0">
          {value.map((reference) => (
            <Badge key={reference.chunkId} variant="secondary" className="h-7 max-w-full gap-1.5 pl-2.5 pr-1">
              <span className="max-w-52 truncate">{reference.sourceTitle}</span>
              <button type="button" aria-label={`移除 ${reference.sourceTitle}`} onClick={() => toggle(reference, false)} className="rounded-full p-0.5 hover:bg-background"><X className="size-3" /></button>
            </Badge>
          ))}
        </CardContent>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>确认本次参考资料</DialogTitle>
            <DialogDescription>最多选择 8 个片段。AI 只会收到这里勾选的内容。</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Enter") void load(search || query, false);
            }} placeholder="搜索知识库" />
            <Button variant="outline" onClick={() => void load(search || query, false)} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <Search />}搜索</Button>
            <Button variant="ghost" size="icon" title="按当前选题重新推荐" onClick={() => void load(query, false)}><RefreshCw /></Button>
          </div>
          <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
            {allCandidates.length === 0 && !loading ? (
              <div className="rounded-lg border border-dashed px-4 py-12 text-center text-muted-foreground">知识库中没有匹配内容，请先上传资料或换个关键词。</div>
            ) : allCandidates.map((reference) => {
              const checked = value.some((item) => item.chunkId === reference.chunkId);
              return (
                <label key={reference.chunkId} className="flex cursor-pointer gap-3 rounded-lg border p-3 hover:bg-muted/50">
                  <Checkbox checked={checked} onCheckedChange={(next) => toggle(reference, next === true)} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2"><span className="truncate font-medium">{reference.sourceTitle}</span><Badge variant="outline">相关度 {Math.round(reference.score)}</Badge></span>
                    <span className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">{reference.content}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <p className="text-right text-xs text-muted-foreground">已选择 {value.length}/8</p>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
