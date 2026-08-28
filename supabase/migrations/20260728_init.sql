create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists brand_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  account_name text not null,
  expert_identity text not null,
  target_audience text not null,
  core_customer_problem text not null,
  content_pillars text[] not null default '{}',
  style text not null,
  banned_expressions text not null,
  conversion_goals text not null,
  course_info text not null,
  consulting_service_info text not null,
  coaching_service_info text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_brand_profiles_workspace on brand_profiles(workspace_id);

create table if not exists knowledge_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null,
  tags text[] not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_knowledge_workspace_type on knowledge_items(workspace_id, type);
create index if not exists idx_knowledge_enabled on knowledge_items(enabled);

create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  core_viewpoint text not null,
  target_audience text not null,
  pain_point text not null,
  content_pillar text not null,
  platform text[] not null default '{}',
  content_goal text not null,
  recommended_format text not null,
  opening_hook text not null,
  scheduled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_topics_workspace_created on topics(workspace_id, created_at desc);
create index if not exists idx_topics_pillar on topics(content_pillar);

create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  topic_id uuid not null references topics(id) on delete cascade,
  platform text not null,
  title text not null,
  body text not null,
  status text not null,
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_content_workspace_status on content_items(workspace_id, status);
create index if not exists idx_content_schedule on content_items(scheduled_at);

create table if not exists video_scripts (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  video_title text not null,
  cover_copy text not null,
  opening_hook_3s text not null,
  spoken_script text not null,
  interaction_question text not null,
  cta text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists video_scenes (
  id uuid primary key default gen_random_uuid(),
  video_script_id uuid not null references video_scripts(id) on delete cascade,
  scene_order int not null,
  script text not null,
  subtitle_focus text not null,
  visual_suggestion text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_video_scenes_script_order on video_scenes(video_script_id, scene_order);

create table if not exists content_reviews (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  score int not null check (score >= 0 and score <= 100),
  issues jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_reviews_content on content_reviews(content_item_id, created_at desc);

create table if not exists content_versions (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  version_number int not null,
  title text not null,
  body text not null,
  change_source text not null check (change_source in ('ai_generate', 'ai_rewrite', 'user_edit', 'restore')),
  created_at timestamptz not null default now()
);
create unique index if not exists idx_versions_unique on content_versions(content_item_id, version_number);

create table if not exists workspace_snapshots (
  id uuid primary key,
  workspace_id uuid not null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists idx_workspace_snapshots_workspace on workspace_snapshots(workspace_id);

-- 公众号图文字段（增量，可重复执行）
alter table content_items add column if not exists digest text;
alter table content_items add column if not exists cover_copy text;
alter table content_items add column if not exists cta text;

