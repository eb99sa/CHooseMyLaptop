-- ===========================================================================
-- CHooseMyLaptop — Row Level Security policies
-- Run AFTER schema.sql.
-- Model: a user owns their profile, sessions, answers, questions, and results.
-- The laptop catalog + reviews are publicly readable; writes are service-role only.
-- ===========================================================================

-- Enable RLS everywhere ----------------------------------------------------
alter table public.users_profile           enable row level security;
alter table public.recommendation_sessions enable row level security;
alter table public.user_answers            enable row level security;
alter table public.ai_questions            enable row level security;
alter table public.laptop_listings         enable row level security;
alter table public.laptop_reviews          enable row level security;
alter table public.recommendation_results  enable row level security;
alter table public.knowledge_documents     enable row level security;
alter table public.knowledge_embeddings    enable row level security;
alter table public.admin_analytics_events  enable row level security;

-- ---------------------------------------------------------------------------
-- users_profile — owner only
-- ---------------------------------------------------------------------------
drop policy if exists profile_select_own on public.users_profile;
create policy profile_select_own on public.users_profile
  for select using (auth_user_id = auth.uid());

drop policy if exists profile_insert_own on public.users_profile;
create policy profile_insert_own on public.users_profile
  for insert with check (auth_user_id = auth.uid());

drop policy if exists profile_update_own on public.users_profile;
create policy profile_update_own on public.users_profile
  for update using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- recommendation_sessions — owner only
-- ---------------------------------------------------------------------------
drop policy if exists sessions_all_own on public.recommendation_sessions;
create policy sessions_all_own on public.recommendation_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Helper: does the current user own this session?
-- ---------------------------------------------------------------------------
create or replace function public.owns_session(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.recommendation_sessions s
    where s.id = sid and s.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- user_answers — scoped to owned session
-- ---------------------------------------------------------------------------
drop policy if exists answers_all_own on public.user_answers;
create policy answers_all_own on public.user_answers
  for all using (public.owns_session(session_id)) with check (public.owns_session(session_id));

-- ---------------------------------------------------------------------------
-- ai_questions — scoped to owned session
-- ---------------------------------------------------------------------------
drop policy if exists questions_all_own on public.ai_questions;
create policy questions_all_own on public.ai_questions
  for all using (public.owns_session(session_id)) with check (public.owns_session(session_id));

-- ---------------------------------------------------------------------------
-- recommendation_results — scoped to owned session
-- ---------------------------------------------------------------------------
drop policy if exists results_select_own on public.recommendation_results;
create policy results_select_own on public.recommendation_results
  for select using (public.owns_session(session_id));

drop policy if exists results_insert_own on public.recommendation_results;
create policy results_insert_own on public.recommendation_results
  for insert with check (public.owns_session(session_id));

-- ---------------------------------------------------------------------------
-- laptop_listings + laptop_reviews — public read, no client writes
-- (writes happen via the service-role key, which bypasses RLS)
-- ---------------------------------------------------------------------------
drop policy if exists listings_public_read on public.laptop_listings;
create policy listings_public_read on public.laptop_listings
  for select using (true);

drop policy if exists reviews_public_read on public.laptop_reviews;
create policy reviews_public_read on public.laptop_reviews
  for select using (true);

-- ---------------------------------------------------------------------------
-- knowledge_* — readable by authenticated users; writes service-role only
-- ---------------------------------------------------------------------------
drop policy if exists knowledge_docs_read on public.knowledge_documents;
create policy knowledge_docs_read on public.knowledge_documents
  for select using (auth.role() = 'authenticated');

drop policy if exists knowledge_emb_read on public.knowledge_embeddings;
create policy knowledge_emb_read on public.knowledge_embeddings
  for select using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- admin_analytics_events — users may insert their own events; reads are
-- service-role only (admin dashboard uses the service-role client).
-- ---------------------------------------------------------------------------
drop policy if exists events_insert_self on public.admin_analytics_events;
create policy events_insert_self on public.admin_analytics_events
  for insert with check (user_id = auth.uid() or user_id is null);
-- (No SELECT policy: only the service-role key can read these.)
