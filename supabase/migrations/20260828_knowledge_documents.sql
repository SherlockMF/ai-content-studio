create table if not exists knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  file_name text not null,
  extension text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  storage_path text,
  extracted_text text not null default '',
  tags text[] not null default '{}',
  enabled boolean not null default true,
  status text not null check (status in ('processing', 'ready', 'failed')),
  error text,
  chunk_count integer not null default 0 check (chunk_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_documents_workspace_updated
  on knowledge_documents(workspace_id, updated_at desc);
create index if not exists idx_knowledge_documents_enabled_status
  on knowledge_documents(workspace_id, enabled, status);
create index if not exists idx_knowledge_documents_tags
  on knowledge_documents using gin(tags);
create index if not exists idx_knowledge_documents_text_search
  on knowledge_documents using gin(to_tsvector('simple', title || ' ' || extracted_text));

create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references knowledge_documents(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  chunk_order integer not null check (chunk_order >= 0),
  content text not null,
  created_at timestamptz not null default now(),
  unique(document_id, chunk_order)
);

create index if not exists idx_knowledge_chunks_document_order
  on knowledge_chunks(document_id, chunk_order);
create index if not exists idx_knowledge_chunks_workspace_search
  on knowledge_chunks using gin(to_tsvector('simple', content));
