-- Apply ONLY to a NEW dedicated Seans Supabase project after checking its identity.
-- Private storage. Clients cannot read tables or invoke these service-only functions.
begin;
create schema if not exists seans_private;
revoke all on schema seans_private from public, anon, authenticated;
create table if not exists seans_private.rooms (
  id uuid primary key,
  owner_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revision bigint not null,
  state jsonb not null,
  check (jsonb_typeof(state) = 'object'),
  check (octet_length(state::text) < 250000)
);
create index if not exists seans_rooms_expiry on seans_private.rooms(expires_at);
create index if not exists seans_rooms_owner on seans_private.rooms(owner_id, created_at);
alter table seans_private.rooms enable row level security;
revoke all on table seans_private.rooms from public, anon, authenticated;

create or replace function public.seans_store_create(p_state jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare owner uuid; expiry timestamptz;
begin
  -- Bound concurrent creates globally. This small private beta is limited to 200 rooms.
  perform pg_catalog.pg_advisory_xact_lock(1376451444);
  delete from seans_private.rooms where expires_at <= now();
  owner := (p_state->>'host')::uuid;
  expiry := pg_catalog.to_timestamp((p_state->>'expiresAt')::double precision/1000);
  if expiry <= now() or expiry > now() + interval '4 hours 2 minutes' or (p_state->>'revision')::int <> 0
     or (p_state->>'phase') <> 'waiting' then raise exception 'INVALID_STATE'; end if;
  if (select count(*) from seans_private.rooms) >= 200
    or (select count(*) from seans_private.rooms where owner_id = owner and created_at > now() - interval '1 hour') >= 5
  then raise exception 'ROOM_LIMIT'; end if;
  insert into seans_private.rooms(id, owner_id, expires_at, revision, state)
    values ((p_state->>'id')::uuid, owner, expiry, 0, p_state);
  return true;
exception when unique_violation then raise exception 'DUPLICATE_ROOM';
end $$;

create or replace function public.seans_store_get(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select state from seans_private.rooms where id = p_id and expires_at > now();
$$;

create or replace function public.seans_store_cas(p_id uuid, p_revision bigint, p_state jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare changed int;
begin
  if (p_state->>'id')::uuid <> p_id or (p_state->>'revision')::bigint <> p_revision + 1 then raise exception 'INVALID_STATE'; end if;
  update seans_private.rooms set state = p_state, revision = p_revision + 1
    where id = p_id and revision = p_revision and expires_at > now()
      and owner_id = (p_state->>'host')::uuid
      and state->>'expiresAt' = p_state->>'expiresAt';
  get diagnostics changed = row_count;
  return changed = 1;
end $$;

create or replace function public.seans_cleanup_expired() returns bigint
language plpgsql security definer set search_path = '' as $$
declare removed bigint;
begin
  delete from seans_private.rooms where expires_at <= now();
  get diagnostics removed = row_count;
  return removed;
end $$;
revoke all on function public.seans_store_create(jsonb) from public, anon, authenticated;
revoke all on function public.seans_store_get(uuid) from public, anon, authenticated;
revoke all on function public.seans_store_cas(uuid,bigint,jsonb) from public, anon, authenticated;
revoke all on function public.seans_cleanup_expired() from public, anon, authenticated;
grant execute on function public.seans_store_create(jsonb) to service_role;
grant execute on function public.seans_store_get(uuid) to service_role;
grant execute on function public.seans_store_cas(uuid,bigint,jsonb) to service_role;
grant execute on function public.seans_cleanup_expired() to service_role;
commit;
-- Schedule seans_cleanup_expired hourly with pg_cron in a separate reviewed step.
-- Access expires immediately even when physical deletion has not run yet.
