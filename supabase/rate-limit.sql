-- Postgres-backed fixed-window rate limiter (serverless-safe; no Redis needed).
-- Run this in the Supabase SQL editor after schema.sql / rls.sql. Service-role only.
-- Used by lib/rate-limit.ts to throttle the anonymous /api/sessions + /answers
-- endpoints (financial-DoS guard) and /api/admin/login (brute-force guard).

create table if not exists rate_limits (
  bucket_key   text primary key,
  count        int not null default 0,
  window_start timestamptz not null default now()
);

-- Deny-by-default like every other table; the service role bypasses RLS.
alter table rate_limits enable row level security;

-- Atomic fixed-window counter. Returns true when the request is ALLOWED
-- (count within p_max for the current window), false when the limit is exceeded.
create or replace function check_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_now   timestamptz := now();
begin
  insert into rate_limits as r (bucket_key, count, window_start)
    values (p_key, 1, v_now)
  on conflict (bucket_key) do update
    set count = case
          when r.window_start < v_now - make_interval(secs => p_window_seconds) then 1
          else r.count + 1 end,
        window_start = case
          when r.window_start < v_now - make_interval(secs => p_window_seconds) then v_now
          else r.window_start end
  returning r.count into v_count;

  return v_count <= p_max;
end;
$$;

revoke all on function check_rate_limit(text, int, int) from public;
grant execute on function check_rate_limit(text, int, int) to service_role;

-- Optional housekeeping (schedule via pg_cron if available) to drop stale buckets:
--   delete from rate_limits where window_start < now() - interval '1 day';
