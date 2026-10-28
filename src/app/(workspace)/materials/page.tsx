"use client";

import { Database, FileText } from "lucide-react";
import { AppShell } from "@/components/shared/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KnowledgeDocumentsTab } from "./components/knowledge-documents-tab";
import { MaterialItemsTab } from "./components/material-items-tab";
import { useKnowledgeDocuments } from "./hooks/use-knowledge-documents";
import { useMaterialForm } from "./hooks/use-material-form";

export default function MaterialsPage() {
  const documents = useKnowledgeDocuments();
  const materialForm = useMaterialForm();

  return (
    <AppShell title="知识库">
      <Tabs defaultValue="documents" className="gap-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">让每次创作都有资料可查</h2>
            <p className="mt-1 text-sm text-muted-foreground">上传笔记并自动切分；生成前由系统推荐，你可以确认实际使用的片段。</p>
          </div>
          <TabsList>
            <TabsTrigger value="documents"><Database />资料文档</TabsTrigger>
            <TabsTrigger value="items"><FileText />知识条目</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="documents" className="space-y-4">
          <KnowledgeDocumentsTab state={documents} />
        </TabsContent>

        <TabsContent value="items">
          <MaterialItemsTab form={materialForm} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
