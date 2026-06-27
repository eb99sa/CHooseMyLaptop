-- ===========================================================================
-- CHooseMyLaptop — Row Level Security (anonymous, server-only access model)
-- Run AFTER schema.sql.
--
-- The app has no user accounts. All reads/writes happen server-side using the
-- Supabase service-role key, which BYPASSES RLS. We still enable RLS on every
-- table with NO policies, so the public/anon PostgREST API is deny-by-default
-- and the browser can never read or write these tables directly.
-- ===========================================================================

alter table public.anonymous_recommendation_sessions enable row level security;
alter table public.laptop_listings                   enable row level security;
alter table public.laptop_reviews                    enable row level security;
alter table public.knowledge_documents               enable row level security;
alter table public.knowledge_embeddings              enable row level security;
alter table public.admin_analytics_events            enable row level security;

-- Intentionally NO policies: anon/authenticated roles get zero access.
-- The service-role key used by the server (API routes) bypasses RLS entirely.
-- If you ever want the browser to read the public catalog directly, add:
--   create policy listings_public_read on public.laptop_listings for select using (true);
-- but the current design keeps all access server-side.
