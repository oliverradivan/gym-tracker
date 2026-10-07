create table public.auth_rate_limits (
  bucket_key text primary key,
  attempts timestamptz[] not null default '{}',
  last_attempt_at timestamptz not null default now()
);

create index auth_rate_limits_last_attempt_idx
  on public.auth_rate_limits (last_attempt_at);

alter table public.auth_rate_limits enable row level security;
revoke all on public.auth_rate_limits from anon, authenticated;
grant all on public.auth_rate_limits to service_role;

create or replace function public.consume_auth_rate_limit(
  p_bucket_key text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  recent_attempts timestamptz[];
  now_at timestamptz := clock_timestamp();
begin
  if p_max_requests < 1 or p_window_seconds < 1 then
    raise exception 'Rate-limit settings must be positive';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_bucket_key, 0));

  delete from public.auth_rate_limits
  where last_attempt_at < now_at - interval '1 hour';

  select coalesce(
    array_agg(attempt_at order by attempt_at),
    '{}'::timestamptz[]
  )
  into recent_attempts
  from public.auth_rate_limits limits,
       unnest(limits.attempts) as attempt_at
  where limits.bucket_key = p_bucket_key
    and attempt_at > now_at - make_interval(secs => p_window_seconds);

  if coalesce(cardinality(recent_attempts), 0) >= p_max_requests then
    update public.auth_rate_limits
    set attempts = recent_attempts,
        last_attempt_at = now_at
    where bucket_key = p_bucket_key;
    return false;
  end if;

  recent_attempts := array_append(coalesce(recent_attempts, '{}'::timestamptz[]), now_at);
  insert into public.auth_rate_limits (bucket_key, attempts, last_attempt_at)
  values (p_bucket_key, recent_attempts, now_at)
  on conflict (bucket_key) do update
    set attempts = excluded.attempts,
        last_attempt_at = excluded.last_attempt_at;

  return true;
end;
$$;

revoke all on function public.consume_auth_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_auth_rate_limit(text, integer, integer)
  to service_role;
