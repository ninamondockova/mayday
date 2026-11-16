-- =====================================================================
--  CLASS VOTE — database schema, security and voting logic
--  Run once in Supabase → SQL Editor (or `supabase db push`).
--
--  Security model
--  * public.sessions  — one row per voting session. Readable by everyone
--    (needed for Realtime), NOT writable by anyone from the browser.
--  * private.*        — secrets, participants and individual votes.
--    The `private` schema is not exposed through the Supabase API, so the
--    browser cannot read or write these tables at all.
--  * All writes go through SECURITY DEFINER functions (RPC) that validate
--    the host secret, the voting state and duplicate votes server-side.
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema private from anon, authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table if not exists public.sessions (
  id            text primary key,
  status        text not null default 'waiting'
                check (status in ('waiting', 'voting', 'closed', 'results')),
  joined_count  integer not null default 0,
  votes_a       integer not null default 0,
  votes_b       integer not null default 0,
  version       bigint  not null default 0,   -- increases on every change (clients use it to ignore stale updates)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Single-row table holding the hashed host passcode.
-- (for databases created before the version column existed)
alter table public.sessions add column if not exists version bigint not null default 0;

create table if not exists private.host_config (
  id             boolean primary key default true check (id),
  passcode_hash  text not null
);

create table if not exists private.session_secrets (
  session_id        text primary key references public.sessions (id) on delete cascade,
  host_secret_hash  text not null
);

create table if not exists private.participants (
  session_id      text not null references public.sessions (id) on delete cascade,
  participant_id  uuid not null,
  joined_at       timestamptz not null default now(),
  primary key (session_id, participant_id)
);

create table if not exists private.votes (
  session_id      text not null,
  participant_id  uuid not null,
  choice          char(1) not null check (choice in ('A', 'B')),
  created_at      timestamptz not null default now(),
  -- one vote per participant per session, enforced by the database
  primary key (session_id, participant_id),
  foreign key (session_id, participant_id)
    references private.participants (session_id, participant_id) on delete cascade
);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.sessions enable row level security;

drop policy if exists "Sessions are readable by everyone" on public.sessions;
create policy "Sessions are readable by everyone"
  on public.sessions for select
  using (true);
-- No insert / update / delete policies: the browser can never write directly.

alter table private.host_config      enable row level security;
alter table private.session_secrets  enable row level security;
alter table private.participants     enable row level security;
alter table private.votes            enable row level security;
-- No policies on private tables = no direct access for API roles.

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke insert, update, delete, truncate on public.sessions from anon, authenticated';
    execute 'grant select on public.sessions to anon, authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Helpers (private, not callable from the browser)
-- ---------------------------------------------------------------------

create or replace function private.hash_text(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_value, 'UTF8')), 'hex');
$$;

-- Run this ONCE from the SQL editor to set (or change) the host passcode:
--   select private.set_host_passcode('choose-a-strong-passcode');
create or replace function private.set_host_passcode(p_passcode text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_passcode is null or length(p_passcode) < 6 then
    raise exception 'Passcode must be at least 6 characters';
  end if;
  insert into private.host_config (id, passcode_hash)
  values (true, private.hash_text(p_passcode))
  on conflict (id) do update set passcode_hash = excluded.passcode_hash;
end;
$$;

create or replace function private.assert_host(p_session_id text, p_host_secret text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_host_secret is null or not exists (
    select 1 from private.session_secrets s
    where s.session_id = upper(p_session_id)
      and s.host_secret_hash = private.hash_text(p_host_secret)
  ) then
    raise exception 'Not authorized as host for this session'
      using errcode = '28000', hint = 'HOST_UNAUTHORIZED';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Public API (RPC)
-- ---------------------------------------------------------------------

-- HOST: create a new session. Requires the host passcode.
-- Returns the short session id and a random host secret (shown only once).
create or replace function public.create_session(p_passcode text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash      text;
  v_id        text;
  v_secret    text;
  v_alphabet  constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_try       integer := 0;
begin
  select passcode_hash into v_hash from private.host_config where id = true;
  if v_hash is null then
    raise exception 'Host passcode is not configured. Run private.set_host_passcode() in the SQL editor.'
      using errcode = '28000', hint = 'HOST_NOT_CONFIGURED';
  end if;

  if p_passcode is null or private.hash_text(p_passcode) <> v_hash then
    perform pg_sleep(0.7); -- slow down brute force attempts
    raise exception 'Wrong host passcode'
      using errcode = '28000', hint = 'HOST_BAD_PASSCODE';
  end if;

  loop
    v_try := v_try + 1;
    v_id := '';
    for i in 1..6 loop
      v_id := v_id || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.sessions where id = v_id);
    if v_try > 20 then
      raise exception 'Could not allocate a session id';
    end if;
  end loop;

  v_secret := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.sessions (id) values (v_id);
  insert into private.session_secrets (session_id, host_secret_hash)
  values (v_id, private.hash_text(v_secret));

  return json_build_object('session_id', v_id, 'host_secret', v_secret);
end;
$$;

-- HOST: check that a stored host secret is still valid (used on reload).
create or replace function public.verify_host(p_session_id text, p_host_secret text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_host(p_session_id, p_host_secret);
  return true;
exception when others then
  return false;
end;
$$;

-- HOST: change the voting state. Only the holder of the host secret can do this.
create or replace function public.set_session_status(
  p_session_id  text,
  p_host_secret text,
  p_status      text
)
returns public.sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.sessions;
begin
  perform private.assert_host(p_session_id, p_host_secret);

  if p_status not in ('waiting', 'voting', 'closed', 'results') then
    raise exception 'Invalid status %', p_status using errcode = '22023';
  end if;

  update public.sessions
     set status = p_status, updated_at = now(), version = version + 1
   where id = upper(p_session_id)
  returning * into v_row;

  return v_row;
end;
$$;

-- PARTICIPANT: join a session (idempotent). Called every time the vote page loads,
-- so it also restores the participant's previous vote after a refresh/reconnect.
create or replace function public.join_session(p_session_id text, p_participant_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session  public.sessions;
  v_inserted integer := 0;
  v_choice   char(1);
begin
  if p_participant_id is null then
    raise exception 'Missing participant id' using errcode = '22023';
  end if;

  select * into v_session from public.sessions where id = upper(p_session_id);
  if not found then
    raise exception 'Session not found' using errcode = 'P0002', hint = 'SESSION_NOT_FOUND';
  end if;

  -- New participants are only counted while the room is open.
  if v_session.status in ('waiting', 'voting') then
    insert into private.participants (session_id, participant_id)
    values (v_session.id, p_participant_id)
    on conflict do nothing;
    get diagnostics v_inserted = row_count;

    if v_inserted > 0 then
      update public.sessions
         set joined_count = joined_count + 1, updated_at = now(), version = version + 1
       where id = v_session.id
      returning * into v_session;
    end if;
  end if;

  select choice into v_choice
    from private.votes
   where session_id = v_session.id and participant_id = p_participant_id;

  return json_build_object(
    'session', row_to_json(v_session),
    'has_voted', v_choice is not null,
    'choice', v_choice
  );
end;
$$;

-- PARTICIPANT: cast a vote. Duplicate votes are rejected by the primary key,
-- and votes are only accepted while the session is in the 'voting' state.
-- Returns { result: 'counted' | 'already_voted' | 'closed', choice }
create or replace function public.cast_vote(
  p_session_id     text,
  p_participant_id uuid,
  p_choice         text
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id        text := upper(p_session_id);
  v_status    text;
  v_choice    char(1) := upper(p_choice);
  v_inserted  integer := 0;
  v_existing  char(1);
  v_updated   integer := 0;
begin
  if p_participant_id is null then
    raise exception 'Missing participant id' using errcode = '22023';
  end if;
  if v_choice is null or v_choice not in ('A', 'B') then
    raise exception 'Invalid choice' using errcode = '22023';
  end if;

  select status into v_status from public.sessions where id = v_id;
  if v_status is null then
    raise exception 'Session not found' using errcode = 'P0002', hint = 'SESSION_NOT_FOUND';
  end if;

  -- Already voted? Always report the stored vote, whatever the state.
  select choice into v_existing
    from private.votes where session_id = v_id and participant_id = p_participant_id;
  if v_existing is not null then
    return json_build_object('result', 'already_voted', 'choice', v_existing);
  end if;

  if v_status <> 'voting' then
    return json_build_object('result', 'closed', 'choice', null);
  end if;

  -- Make sure the participant is registered (in case join_session was skipped).
  insert into private.participants (session_id, participant_id)
  values (v_id, p_participant_id)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted > 0 then
    update public.sessions set joined_count = joined_count + 1, updated_at = now(), version = version + 1 where id = v_id;
  end if;

  insert into private.votes (session_id, participant_id, choice)
  values (v_id, p_participant_id, v_choice)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    -- A parallel request from the same participant won the race.
    select choice into v_existing
      from private.votes where session_id = v_id and participant_id = p_participant_id;
    return json_build_object('result', 'already_voted', 'choice', v_existing);
  end if;

  -- Atomic counter update, guarded by the state (host may have closed meanwhile).
  update public.sessions
     set votes_a    = votes_a + (case when v_choice = 'A' then 1 else 0 end),
         votes_b    = votes_b + (case when v_choice = 'B' then 1 else 0 end),
         updated_at = now(),
         version    = version + 1
   where id = v_id and status = 'voting';
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    delete from private.votes where session_id = v_id and participant_id = p_participant_id;
    return json_build_object('result', 'closed', 'choice', null);
  end if;

  return json_build_object('result', 'counted', 'choice', v_choice);
end;
$$;

-- ---------------------------------------------------------------------
-- Function permissions: only the five RPCs are callable from the browser.
-- ---------------------------------------------------------------------

revoke all on function private.hash_text(text)               from public;
revoke all on function private.set_host_passcode(text)       from public;
revoke all on function private.assert_host(text, text)       from public;

revoke all on function public.create_session(text)                    from public;
revoke all on function public.verify_host(text, text)                 from public;
revoke all on function public.set_session_status(text, text, text)   from public;
revoke all on function public.join_session(text, uuid)                from public;
revoke all on function public.cast_vote(text, uuid, text)             from public;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.create_session(text)                  to anon, authenticated';
    execute 'grant execute on function public.verify_host(text, text)               to anon, authenticated';
    execute 'grant execute on function public.set_session_status(text, text, text) to anon, authenticated';
    execute 'grant execute on function public.join_session(text, uuid)              to anon, authenticated';
    execute 'grant execute on function public.cast_vote(text, uuid, text)           to anon, authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Realtime: broadcast changes of public.sessions to subscribed clients
-- ---------------------------------------------------------------------

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sessions'
     ) then
    execute 'alter publication supabase_realtime add table public.sessions';
  end if;
end $$;
