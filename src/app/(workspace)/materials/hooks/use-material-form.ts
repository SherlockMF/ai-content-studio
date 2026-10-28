"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useStoreActions, useWorkspaceState } from "@/lib/store/app-store";
import type { MaterialItem, MaterialType } from "@/types/domain";
import { makeMaterialId } from "./material-ids";

export const MATERIAL_TYPES: MaterialType[] = ["观点", "案例", "素材片段", "常用表达", "禁止表达"];

export function useMaterialForm() {
  const { materials } = useWorkspaceState();
  const { upsertMaterial, toggleMaterial, deleteMaterial } = useStoreActions();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<MaterialType>("观点");
  const [tags, setTags] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<MaterialType | "全部">("全部");
  const [query, setQuery] = useState("");

  const reset = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setType("观点");
    setTags("");
  };

  const edit = (item: MaterialItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setBody(item.body);
    setType(item.type);
    setTags(item.tags.join("，"));
  };

  const save = () => {
    if (!title.trim() || !body.trim()) {
      toast.error("请填写标题和正文");
      return;
    }
    const existing = materials.find((item) => item.id === editingId);
    const now = new Date().toISOString();
    upsertMaterial({
      id: existing?.id ?? makeMaterialId("material"),
      workspaceId: existing?.workspaceId ?? "ws_demo",
      title: title.trim(),
      body: body.trim(),
      type,
      tags: tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
      enabled: existing?.enabled ?? true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    toast.success(existing ? "知识条目已更新" : "知识条目已添加");
    reset();
  };

  const remove = (item: MaterialItem) => {
    if (!window.confirm(`确定删除“${item.title}”吗？`)) return;
    deleteMaterial(item.id);
    if (editingId === item.id) reset();
    toast.success("知识条目已删除");
  };

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleMaterials = materials.filter((item) => {
    if (filter !== "全部" && item.type !== filter) return false;
    return !normalizedQuery || [item.title, item.body, item.tags.join(" ")]
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });

  return {
    fields: { title, body, type, tags },
    setTitle,
    setBody,
    setType,
    setTags,
    editingId,
    filter,
    setFilter,
    query,
    setQuery,
    visibleMaterials,
    reset,
    edit,
    save,
    remove,
    toggle: toggleMaterial,
  };
}

export type MaterialFormState = ReturnType<typeof useMaterialForm>;
