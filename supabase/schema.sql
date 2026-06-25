-- ===========================================================================
-- CHooseMyLaptop — Database schema (Supabase Postgres)
-- Run this in: Supabase Dashboard > SQL Editor (or `supabase db push`).
-- Run order: 1) schema.sql  2) rls.sql  3) seed.sql
-- ===========================================================================

-- Extensions ---------------------------------------------------------------
create extension if not exists pgcrypto;      -- gen_random_uuid()
create extension if not exists vector;         -- pgvector (RAG, Phase 2)

-- ---------------------------------------------------------------------------
-- users_profile
-- ---------------------------------------------------------------------------
create table if not exists public.users_profile (
  id                 uuid primary key default gen_random_uuid(),
  auth_user_id       uuid not null unique references auth.users (id) on delete cascade,
  full_name          text,
  preferred_language text not null default 'ar',
  country            text,
  city               text,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- recommendation_sessions
-- user_id stores the auth.users id directly so RLS stays simple.
-- basic_needs_json / spec_json / report_json cache the full structured payloads.
-- ---------------------------------------------------------------------------
create table if not exists public.recommendation_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  status           text not null default 'draft'
                     check (status in ('draft','questions_ready','answered','completed','failed')),
  budget_min       numeric,
  budget_max       numeric,
  currency         text default 'KWD',
  country          text,
  city             text,
  primary_use_case text,
  basic_needs_json jsonb,
  spec_json        jsonb,
  report_json      jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_sessions_user on public.recommendation_sessions (user_id);
create index if not exists idx_sessions_status on public.recommendation_sessions (status);
create index if not exists idx_sessions_use_case on public.recommendation_sessions (primary_use_case);

-- ---------------------------------------------------------------------------
-- user_answers
-- ---------------------------------------------------------------------------
create table if not exists public.user_answers (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.recommendation_sessions (id) on delete cascade,
  question_key text not null,
  question_text text,
  answer_value text,
  answer_type  text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_answers_session on public.user_answers (session_id);

-- ---------------------------------------------------------------------------
-- ai_questions
-- ---------------------------------------------------------------------------
create table if not exists public.ai_questions (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null references public.recommendation_sessions (id) on delete cascade,
  question_key        text,
  question_text       text not null,
  question_type       text,
  options_json        jsonb,
  reason_for_question text,
  sort_order          int default 0,
  created_at          timestamptz not null default now()
);
create index if not exists idx_questions_session on public.ai_questions (session_id);

-- ---------------------------------------------------------------------------
-- laptop_listings (catalog)
-- ---------------------------------------------------------------------------
create table if not exists public.laptop_listings (
  id              uuid primary key default gen_random_uuid(),
  store_name      text,
  product_title   text not null,
  brand           text,
  model           text,
  price           numeric not null,
  currency        text not null default 'KWD',
  availability    text default 'unknown',
  url             text,
  specs_json      jsonb not null default '{}'::jsonb,
  rating          numeric,
  review_count    int,
  source_type     text default 'seed',   -- seed | scraped | manual
  last_checked_at timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_listings_price on public.laptop_listings (price);
create index if not exists idx_listings_brand on public.laptop_listings (brand);

-- ---------------------------------------------------------------------------
-- laptop_reviews
-- ---------------------------------------------------------------------------
create table if not exists public.laptop_reviews (
  id                uuid primary key default gen_random_uuid(),
  laptop_listing_id uuid not null references public.laptop_listings (id) on delete cascade,
  source_name       text,
  source_url        text,
  rating            numeric,
  review_summary    text,
  pros_json         jsonb,
  cons_json         jsonb,
  created_at        timestamptz not null default now()
);
create index if not exists idx_reviews_listing on public.laptop_reviews (laptop_listing_id);

-- ---------------------------------------------------------------------------
-- recommendation_results (normalized rows for analytics + CSV export)
-- ---------------------------------------------------------------------------
create table if not exists public.recommendation_results (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null references public.recommendation_sessions (id) on delete cascade,
  laptop_listing_id   uuid references public.laptop_listings (id) on delete set null,
  fit_score           numeric,
  roi_score           numeric,
  final_score         numeric,
  recommendation_type text,  -- best_overall | best_budget | best_value | avoid | ranked
  reasoning           text,
  warnings_json       jsonb,
  created_at          timestamptz not null default now()
);
create index if not exists idx_results_session on public.recommendation_results (session_id);
create index if not exists idx_results_listing on public.recommendation_results (laptop_listing_id);

-- ---------------------------------------------------------------------------
-- knowledge_documents + knowledge_embeddings (RAG — Phase 2 scaffold)
-- ---------------------------------------------------------------------------
create table if not exists public.knowledge_documents (
  id            uuid primary key default gen_random_uuid(),
  title         text,
  source_url    text,
  content       text,
  content_type  text,
  metadata_json jsonb,
  created_at    timestamptz not null default now()
);

create table if not exists public.knowledge_embeddings (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.knowledge_documents (id) on delete cascade,
  embedding     vector(1536),
  chunk_text    text,
  metadata_json jsonb,
  created_at    timestamptz not null default now()
);
-- Approximate nearest-neighbor index for cosine similarity (used in Phase 2).
create index if not exists idx_embeddings_vector
  on public.knowledge_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ---------------------------------------------------------------------------
-- admin_analytics_events
-- ---------------------------------------------------------------------------
create table if not exists public.admin_analytics_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users (id) on delete set null,
  event_type    text not null,
  event_payload jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_events_type on public.admin_analytics_events (event_type);
create index if not exists idx_events_created on public.admin_analytics_events (created_at);

-- ---------------------------------------------------------------------------
-- updated_at trigger for sessions
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_sessions_updated_at on public.recommendation_sessions;
create trigger trg_sessions_updated_at
  before update on public.recommendation_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create a profile row when a new auth user signs up.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users_profile (auth_user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', null))
  on conflict (auth_user_id) do nothing;
  return new;
end; $$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
