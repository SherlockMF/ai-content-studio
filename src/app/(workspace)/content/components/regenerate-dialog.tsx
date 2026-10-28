"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WechatGenerateMode } from "@/types/domain";

export function RegenerateDialog({
  open,
  onOpenChange,
  isEvaluation,
  loading,
  onRun,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEvaluation: boolean;
  loading: boolean;
  onRun: (mode: WechatGenerateMode) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>如何处理已有草稿？</DialogTitle>
          <DialogDescription>
            {isEvaluation
              ? "检测到测评型正文。默认只做润色，不会整篇覆盖。"
              : "默认只做润色，保留你的正文。从零重写会丢失现有内容。"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button disabled={loading} onClick={() => onRun("polish")}>
            润色去 AI 味
          </Button>
          {isEvaluation ? (
            <Button variant="secondary" disabled={loading} onClick={() => onRun("preserve_structure")}>
              优化表达
            </Button>
          ) : null}
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => {
              const message = isEvaluation
                ? "从零重写将丢弃当前正文中的测评细节与数据，确定继续？"
                : "从零重写将丢弃当前正文，确定继续？";
              if (window.confirm(message)) onRun("from_scratch");
            }}
          >
            从零重写
          </Button>
        </div>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}
