"use client";

import { useRef } from "react";
import { insertMarkdownAtCursor } from "@/lib/insert-markdown-at-cursor";

/** 记录正文光标位置，支持在光标处插入 Markdown 片段 */
export function useBodyInsertion(body: string, setBody: (body: string) => void) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef({ start: 0, end: 0 });

  const rememberSelection = () => {
    const el = textareaRef.current;
    if (!el) return;
    selectionRef.current = { start: el.selectionStart, end: el.selectionEnd };
  };

  const insertIntoBody = (snippet: string) => {
    const { next, cursor } = insertMarkdownAtCursor(body, snippet, selectionRef.current);
    setBody(next);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(cursor, cursor);
      selectionRef.current = { start: cursor, end: cursor };
    });
  };

  return { textareaRef, rememberSelection, insertIntoBody };
}
