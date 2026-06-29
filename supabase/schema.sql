-- ===========================================================================
-- CHooseMyLaptop — Database schema (anonymous, no user accounts)
-- Run order: 1) schema.sql  2) rls.sql  3) seed.sql
--
-- The app is anonymous: there are NO user accounts, profiles, or auth. Each
-- recommendation attempt is an anonymous session. All DB access happens
-- server-side via the Supabase service-role key (see lib/supabase/service.ts);
-- RLS is enabled with NO public policies so the anon/public API cannot read or
-- write these tables directly (defense in depth).
-- ===========================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists vector;       -- pgvector (RAG, Phase 2)

-- Migrating from the previous version? Drop old/renamed objects first.
-- NOTE: this drops laptop_listings/laptop_reviews/admin_analytics_events so
-- their new columns (country, city_or_area, anonymous_session_id) apply; re-run
-- seed.sql afterwards to repopulate the catalog.
drop table if exists public.recommendation_results cascade;
drop table if exists public.user_answers cascade;
drop table if exists public.ai_questions cascade;
drop table if exists public.recommendation_sessions cascade;
drop table if exists public.users_profile cascade;
drop table if exists public.admin_analytics_events cascade;
drop table if exists public.laptop_reviews cascade;
drop table if exists public.laptop_listings cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.owns_session(uuid) cascade;
drop function if exists public.set_updated_at() cascade;

-- ---------------------------------------------------------------------------
-- anonymous_recommendation_sessions
-- One row per recommendation attempt. No personal identity is stored.
-- `session_token_hash` is sha256(raw token); the raw token lives only in an
-- HTTP-only cookie in the user's browser so the same browser can reload its
-- report for a limited time. Location is stored as approximate area only.
-- ---------------------------------------------------------------------------
create table if not exists public.anonymous_recommendation_sessions (
  id                        uuid primary key default gen_random_uuid(),
  session_token_hash        text not null,
  status                    text not null default 'questions_ready'
                              check (status in ('questions_ready','answered','completed','failed')),
  budget_min                numeric,
  budget_max                numeric,
  currency                  text default 'KWD',
  country                   text,
  city_or_area              text,
  location_source           text not null default 'skipped'
                              check (location_source in ('browser_geolocation','manual_search','skipped')),
  primary_use_case          text,
  basic_needs_json          jsonb,
  answers_json              jsonb,
  ai_followup_questions_json jsonb,
  recommended_specs_json    jsonb,
  recommendation_result_json jsonb,
  created_at                timestamptz not null default now(),
  expires_at                timestamptz not null default (now() + interval '7 days')
);
create index if not exists idx_anon_sessions_token on public.anonymous_recommendation_sessions (session_token_hash);
create index if not exists idx_anon_sessions_status on public.anonymous_recommendation_sessions (status);
create index if not exists idx_anon_sessions_created on public.anonymous_recommendation_sessions (created_at);
create index if not exists idx_anon_sessions_use_case on public.anonymous_recommendation_sessions (primary_use_case);
create index if not exists idx_anon_sessions_expires on public.anonymous_recommendation_sessions (expires_at);

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
  country         text,
  city_or_area    text,
  specs_json      jsonb not null default '{}'::jsonb,
  rating          numeric,
  review_count    int,
  source_type     text default 'seed',   -- seed | scraped | manual
  last_checked_at timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_listings_price on public.laptop_listings (price);
create index if not exists idx_listings_brand on public.laptop_listings (brand);
create index if not exists idx_listings_country on public.laptop_listings (country);

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
-- NOTE: intentionally NO ANN (ivfflat/hnsw) index here. The curated knowledge
-- corpus is small (tens to low-hundreds of chunks); an ivfflat index with
-- lists=100 on a tiny table returns almost nothing under the default probes=1
-- (each cluster holds ~0-1 vectors), which silently cripples retrieval. Exact KNN
-- via seq-scan is accurate and sub-millisecond at this scale + this app's low QPS.
-- Add a tuned HNSW index only if the corpus ever grows to many thousands of chunks.

-- ---------------------------------------------------------------------------
-- admin_analytics_events (anonymous; references the anonymous session only)
-- ---------------------------------------------------------------------------
create table if not exists public.admin_analytics_events (
  id                   uuid primary key default gen_random_uuid(),
  anonymous_session_id uuid references public.anonymous_recommendation_sessions (id) on delete set null,
  event_type           text not null,
  event_payload        jsonb,
  created_at           timestamptz not null default now()
);
create index if not exists idx_events_type on public.admin_analytics_events (event_type);
create index if not exists idx_events_created on public.admin_analytics_events (created_at);
