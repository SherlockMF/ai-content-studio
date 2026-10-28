"use client";

import { useRef, type ReactNode } from "react";
import { KnowledgeReferencePicker } from "@/components/shared/knowledge-reference-picker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SUPPLEMENTARY_DOC_ACCEPT } from "@/lib/extract-document-text";
import type { KnowledgeReference } from "@/types/domain";

export function WechatDraftExtras(props: {
  children?: ReactNode;
  isImported: boolean;
  isEvaluation: boolean;
  hasTopic: boolean;
  canRestoreOriginal: boolean;
  canDiscard: boolean;
  onOpenImport: () => void;
  onRestoreOriginal: () => void;
  onDiscard: () => void;
  knowledgeQuery: string;
  knowledgeReferences: KnowledgeReference[];
  onKnowledgeReferencesChange: (value: KnowledgeReference[]) => void;
  supplementaryNotes: string;
  onSupplementaryNotesChange: (value: string) => void;
  supplementaryDocLoading: boolean;
  onUploadSupplementaryDoc: (file: File) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <details className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-slate-700">更多操作与资料</summary>
      <div className="mt-3 space-y-3">
        {props.children}
        <p className="text-xs text-slate-500">
          {props.isImported
            ? props.isEvaluation
              ? "测评稿以你的测试过程与数据为准；AI 仅做润色，不会默认整篇重写。"
              : "已有草稿以你的正文为准；AI 仅做润色，不会默认整篇重写。"
            : "AI 生成稿会在出稿时自动去 AI 味。"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={!props.hasTopic} onClick={props.onOpenImport}>
            导入 Markdown
          </Button>
          {props.canRestoreOriginal ? (
            <Button variant="outline" size="sm" onClick={props.onRestoreOriginal}>
              恢复原始草稿
            </Button>
          ) : null}
          <Button variant="outline" size="sm" disabled={!props.canDiscard} onClick={props.onDiscard}>
            放弃未保存修改
          </Button>
        </div>
        {props.hasTopic ? (
          <KnowledgeReferencePicker
            query={props.knowledgeQuery}
            value={props.knowledgeReferences}
            onChange={props.onKnowledgeReferencesChange}
            compact
          />
        ) : null}
        <div className="space-y-2 rounded-lg border border-amber-100 bg-amber-50/40 p-3">
          <p className="text-sm font-medium text-slate-700">补充信息</p>
          <p className="text-xs text-slate-500">
            模型实名、测试条件等；也可上传文档，AI 润色与质检时会融入。
          </p>
          <input
            ref={fileRef}
            type="file"
            accept={SUPPLEMENTARY_DOC_ACCEPT}
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              await props.onUploadSupplementaryDoc(file);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={props.supplementaryDocLoading}
            onClick={() => fileRef.current?.click()}
          >
            {props.supplementaryDocLoading ? "解析中…" : "上传补充文档"}
          </Button>
          <Textarea
            value={props.supplementaryNotes}
            onChange={(e) => props.onSupplementaryNotesChange(e.target.value)}
            rows={4}
            placeholder="例如：Cola-A 现为 August（Qwen 3.8 Flash）…"
            className="font-mono text-sm leading-relaxed"
          />
        </div>
      </div>
    </details>
  );
}
