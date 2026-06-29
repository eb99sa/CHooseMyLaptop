-- ===========================================================================
-- CHooseMyLaptop — RAG retrieval function (Phase 2)
-- Run AFTER schema.sql (which creates the `vector` extension, the
-- knowledge_documents / knowledge_embeddings tables, and the ivfflat index).
--
-- This adds a single SECURITY-safe, parameterized similarity-search function the
-- server calls via supabase.rpc('match_knowledge', ...). It is read-only and
-- additive; re-running it is safe (create or replace).
-- ===========================================================================

-- Existing databases may carry an oversized ivfflat index from an earlier
-- schema.sql (lists=100) that cripples recall on the small curated corpus — under
-- the default probes=1 it returns ~0-1 of N rows. Drop it; exact KNN (seq-scan) is
-- accurate and fast at this scale. See the note in schema.sql.
drop index if exists public.idx_embeddings_vector;

create or replace function public.match_knowledge(
  query_embedding   vector(1536),
  match_count       int default 6,
  filter_content_type text default null
)
returns table (
  id            uuid,
  document_id   uuid,
  chunk_text    text,
  similarity    float,
  metadata_json jsonb
)
language sql
stable
as $$
  select
    e.id,
    e.document_id,
    e.chunk_text,
    1 - (e.embedding <=> query_embedding) as similarity, -- cosine similarity 0..1
    e.metadata_json
  from public.knowledge_embeddings e
  where e.embedding is not null
    and (
      filter_content_type is null
      or (e.metadata_json ->> 'content_type') = filter_content_type
    )
  order by e.embedding <=> query_embedding  -- cosine distance, ascending
  limit greatest(1, least(match_count, 50));
$$;

comment on function public.match_knowledge is
  'Cosine nearest-neighbour search over knowledge_embeddings for RAG. Server-only (called with the service role); no public grant.';

-- Defense in depth: this is only ever called server-side with the service role.
-- Remove the default PUBLIC execute grant so the anon/authenticated roles can't
-- call it via PostgREST. (RLS already denies them the underlying rows, since the
-- function runs SECURITY INVOKER — this just makes the "no public grant" explicit.)
revoke all on function public.match_knowledge(vector, int, text) from public;
grant execute on function public.match_knowledge(vector, int, text) to service_role;
