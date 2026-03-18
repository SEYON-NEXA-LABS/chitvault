-- ============================================================
-- ChitVault SaaS — Multi-Tenant Schema (v1.1)
-- Safe to run in Supabase SQL Editor (idempotent)
-- ============================================================

-- ── 0. PREREQS & EXTENSIONS ─────────────────────────────────
-- Ensure we can generate UUIDs and track update times.
create extension if not exists pgcrypto;           -- gen_random_uuid()
create extension if not exists moddatetime;        -- trigger to auto-update updated_at

-- Always operate in public
set search_path = public;

-- ── 1. CORE TABLES ───────────────────────────────────────────

-- 1.1 FIRMS
create table if not exists firms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  owner_id    uuid references auth.users(id) on delete set null,
  plan        text default 'trial',
  plan_status text default 'active',
  trial_ends  timestamptz default (now() + interval '30 days'),
  invoice_ref text,
  city        text,
  phone       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Normalize enums / checks
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'firms_plan_chk'
  ) then
    alter table firms
      add constraint firms_plan_chk
      check (plan in ('trial','basic','pro'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'firms_plan_status_chk'
  ) then
    alter table firms
      add constraint firms_plan_status_chk
      check (plan_status in ('active','suspended','cancelled'));
  end if;
end $$;

-- Auto updated_at
drop trigger if exists set_firms_updated_at on firms;
create trigger set_firms_updated_at
before update on firms
for each row execute procedure moddatetime (updated_at);

-- 1.2 PROFILES (links auth users to firms + role)
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  firm_id    uuid references firms(id) on delete cascade,
  full_name  text,
  role       text default 'staff',   -- owner | staff | superadmin
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_chk'
  ) then
    alter table profiles
      add constraint profiles_role_chk
      check (role in ('owner','staff','superadmin'));
  end if;
end $$;

drop trigger if exists set_profiles_updated_at on profiles;
create trigger set_profiles_updated_at
before update on profiles
for each row execute procedure moddatetime (updated_at);

-- 1.3 GROUPS
create table if not exists groups (
  id                   bigint primary key generated always as identity,
  firm_id              uuid not null references firms(id) on delete cascade,
  name                 text not null,
  chit_value           numeric(12,2) not null,
  num_members          int not null,
  duration             int not null,                        -- months
  monthly_contribution numeric(12,2) not null,
  start_date           date,
  status               text default 'active',
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),
  constraint groups_status_chk check (status in ('active','paused','closed')),
  constraint groups_nonneg_chk check (num_members > 0 and duration > 0 and chit_value >= 0 and monthly_contribution >= 0)
);

-- Composite unique for cross-table FKs
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'groups_firm_id_id_unique'
  ) then
    alter table groups
      add constraint groups_firm_id_id_unique unique (firm_id, id);
  end if;
end $$;

drop trigger if exists set_groups_updated_at on groups;
create trigger set_groups_updated_at
before update on groups
for each row execute procedure moddatetime (updated_at);

-- 1.4 MEMBERS
create table if not exists members (
  id               bigint primary key generated always as identity,
  firm_id          uuid not null references firms(id) on delete cascade,
  name             text not null,
  phone            text,
  address          text,
  group_id         bigint references groups(id) on delete cascade,
  ticket_no        int not null,
  status           text default 'active',
  exit_month       int,
  transfer_from_id bigint references members(id) on delete set null,
  contact_id       bigint,
  notes            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  constraint members_status_chk check (status in ('active','transferred','exited'))
);

-- Ensure ticket unique per group
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'members_group_ticket_unique'
  ) then
    alter table members
      add constraint members_group_ticket_unique unique (group_id, ticket_no);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'members_firm_id_id_unique'
  ) then
    alter table members
      add constraint members_firm_id_id_unique unique (firm_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'members_group_firm_fk'
  ) then
    alter table members
      add constraint members_group_firm_fk
      foreign key (firm_id, group_id) references groups(firm_id, id)
      on delete cascade;
  end if;
end $$;

drop trigger if exists set_members_updated_at on members;
create trigger set_members_updated_at
before update on members
for each row execute procedure moddatetime (updated_at);

-- 1.5 AUCTIONS
create table if not exists auctions (
  id           bigint primary key generated always as identity,
  firm_id      uuid not null references firms(id) on delete cascade,
  group_id     bigint references groups(id) on delete cascade,
  month        int not null,
  auction_date date,
  winner_id    bigint references members(id) on delete set null,
  bid_amount   numeric(12,2) not null,
  total_pot    numeric(12,2) not null,
  dividend     numeric(12,2) not null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique(firm_id, group_id, month),
  constraint auctions_amounts_nonneg_chk check (bid_amount >= 0 and total_pot >= 0 and dividend >= 0)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'auctions_group_firm_fk'
  ) then
    alter table auctions
      add constraint auctions_group_firm_fk
      foreign key (firm_id, group_id) references groups(firm_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'auctions_winner_firm_fk'
  ) then
    alter table auctions
      add constraint auctions_winner_firm_fk
      foreign key (firm_id, winner_id) references members(firm_id, id)
      on delete set null;
  end if;
end $$;

drop trigger if exists set_auctions_updated_at on auctions;
create trigger set_auctions_updated_at
before update on auctions
for each row execute procedure moddatetime (updated_at);

-- 1.6 PAYMENTS (supports partial payments)
create table if not exists payments (
  id           bigint primary key generated always as identity,
  firm_id      uuid not null references firms(id) on delete cascade,
  member_id    bigint references members(id) on delete cascade,
  group_id     bigint references groups(id) on delete cascade,
  month        int not null,
  amount       numeric(12,2) not null,
  payment_date date,
  mode         text default 'Cash',
  status       text default 'paid',
  payment_type text default 'full',     -- full | partial
  amount_due   numeric(12,2) default 0,
  balance_due  numeric(12,2) default 0,
  collected_by uuid references auth.users(id) on delete set null
                default auth.uid(),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  constraint payments_amounts_nonneg_chk
    check (amount >= 0 and amount_due >= 0 and balance_due >= 0)
);

-- Remove old uniqueness if exists (allow multiple payments per month)
alter table payments
  drop constraint if exists payments_firm_id_member_id_group_id_month_key,
  drop constraint if exists payments_member_id_group_id_month_key;

-- Composite integrity for firm consistency
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_group_firm_fk'
  ) then
    alter table payments
      add constraint payments_group_firm_fk
      foreign key (firm_id, group_id) references groups(firm_id, id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_member_firm_fk'
  ) then
    alter table payments
      add constraint payments_member_firm_fk
      foreign key (firm_id, member_id) references members(firm_id, id)
      on delete cascade;
  end if;
end $$;

drop trigger if exists set_payments_updated_at on payments;
create trigger set_payments_updated_at
before update on payments
for each row execute procedure moddatetime (updated_at);

-- 1.7 INVITES
create table if not exists invites (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references firms(id) on delete cascade,
  email       text not null,
  role        text default 'staff',        -- staff | owner
  invited_by  uuid references auth.users(id),
  status      text default 'pending',      -- pending | accepted | expired
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  expires_at  timestamptz default (now() + interval '7 days'),
  unique(firm_id, email)
);

drop trigger if exists set_invites_updated_at on invites;
create trigger set_invites_updated_at
before update on invites
for each row execute procedure moddatetime (updated_at);

-- 1.8 DENOMINATIONS (daily cash count)
create table if not exists denominations (
  id           bigint primary key generated always as identity,
  firm_id      uuid not null references firms(id) on delete cascade,
  entry_date   date not null default current_date,
  collected_by uuid references auth.users(id) on delete set null default auth.uid(),

  note_2000    int default 0,
  note_500     int default 0,
  note_200     int default 0,
  note_100     int default 0,
  note_50      int default 0,
  note_20      int default 0,
  note_10      int default 0,
  coin_5       int default 0,
  coin_2       int default 0,
  coin_1       int default 0,

  total        numeric generated always as (
    note_2000*2000 + note_500*500 + note_200*200 + note_100*100 +
    note_50*50 + note_20*20 + note_10*10 +
    coin_5*5 + coin_2*2 + coin_1*1
  ) stored,

  notes        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

drop trigger if exists set_denominations_updated_at on denominations;
create trigger set_denominations_updated_at
before update on denominations
for each row execute procedure moddatetime (updated_at);

-- ── 2. INDEXES ───────────────────────────────────────────────
create index if not exists idx_groups_firm                  on groups(firm_id);
create index if not exists idx_members_firm                 on members(firm_id);
create index if not exists idx_members_group                on members(group_id);
create index if not exists idx_auctions_firm                on auctions(firm_id);
create index if not exists idx_auctions_group_month         on auctions(group_id, month);
create index if not exists idx_payments_firm                on payments(firm_id);
create index if not exists idx_payments_member_month        on payments(firm_id, member_id, group_id, month);
create index if not exists idx_payments_group_month_member  on payments(group_id, month, member_id);
create index if not exists idx_profiles_firm                on profiles(firm_id);
create index if not exists idx_denominations_firm_date      on denominations(firm_id, entry_date desc);

-- ── 3. RLS & HELPERS ────────────────────────────────────────
alter table firms         enable row level security;
alter table profiles      enable row level security;
alter table groups        enable row level security;
alter table members       enable row level security;
alter table auctions      enable row level security;
alter table payments      enable row level security;
alter table invites       enable row level security;
alter table denominations enable row level security;

-- Helpers with pinned search_path (safer for SECURITY DEFINER)
create or replace function my_firm_id()
returns uuid
language sql
stable
set search_path = public
as $$
  select firm_id
  from profiles
  where id = auth.uid()
  order by created_at desc
  limit 1
$$;

create or replace function is_superadmin()
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role = 'superadmin'
  )
$$;

create or replace function is_firm_owner()
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from profiles
    where id = auth.uid()
      and firm_id = my_firm_id()
      and role in ('owner','superadmin')
  )
$$;

-- Drop all existing policies on our tables (safely)
do $pol$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where tablename in ('firms','profiles','groups','members','auctions','payments','invites','denominations')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end
$pol$;

-- FIRMS: owner or superadmin
create policy firms_select on firms for select
  using (owner_id = auth.uid() or is_superadmin());
create policy firms_insert on firms for insert
  with check (owner_id = auth.uid() or is_superadmin());
create policy firms_update on firms for update
  using (owner_id = auth.uid() or is_superadmin());

-- PROFILES:
-- 1) Insert must allow signup trigger (auth.uid() may be null there) -> unblock signup
create policy profiles_insert_signup on profiles for insert
  to public
  with check (true);

-- 2) Select: own profile, same firm, or superadmin
create policy profiles_select on profiles for select
  using (id = auth.uid() or firm_id = my_firm_id() or is_superadmin());

-- 3) Update: only self or superadmin (but block direct firm_id changes via trigger below)
create policy profiles_update on profiles for update
  using (id = auth.uid() or is_superadmin());

-- GROUPS: owner write, staff read
create policy groups_select on groups for select
  using (firm_id = my_firm_id() or is_superadmin());
create policy groups_insert on groups for insert
  with check ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());
create policy groups_update on groups for update
  using ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());
create policy groups_delete on groups for delete
  using ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());

-- MEMBERS: owner write, staff read
create policy members_select on members for select
  using (firm_id = my_firm_id() or is_superadmin());
create policy members_insert on members for insert
  with check ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());
create policy members_update on members for update
  using ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());
create policy members_delete on members for delete
  using ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());

-- AUCTIONS: owner write, staff read
create policy auctions_select on auctions for select
  using (firm_id = my_firm_id() or is_superadmin());
create policy auctions_insert on auctions for insert
  with check ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());
create policy auctions_update on auctions for update
  using ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());
create policy auctions_delete on auctions for delete
  using ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());

-- PAYMENTS: owner+staff can record; owner can update/delete
create policy payments_select on payments for select
  using (firm_id = my_firm_id() or is_superadmin());
create policy payments_insert on payments for insert
  with check (firm_id = my_firm_id() or is_superadmin());
create policy payments_update on payments for update
  using ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());
create policy payments_delete on payments for delete
  using ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());

-- INVITES: owner manage, stricter than public read
create policy invites_select on invites for select
  using (firm_id = my_firm_id() or is_superadmin());
create policy invites_insert on invites for insert
  with check (firm_id = my_firm_id());
create policy invites_update on invites for update
  using (firm_id = my_firm_id() or is_superadmin());
create policy invites_delete on invites for delete
  using (firm_id = my_firm_id() or is_superadmin());

-- DENOMINATIONS: both owner and staff can create; owner can delete
create policy denom_select on denominations for select
  using (firm_id = my_firm_id() or is_superadmin());
create policy denom_insert on denominations for insert
  with check (firm_id = my_firm_id());
create policy denom_update on denominations for update
  using (firm_id = my_firm_id() and (collected_by = auth.uid() or is_firm_owner()));
create policy denom_delete on denominations for delete
  using (firm_id = my_firm_id() and is_firm_owner());

-- GRANTS
grant usage, select on all sequences in schema public to authenticated;
grant all on firms, profiles, groups, members, auctions, payments, invites, denominations to authenticated;

-- ── 4. TRIGGERS FOR CONSISTENCY ─────────────────────────────

-- Block direct change of profiles.firm_id (must use accept_invite RPC)
create or replace function trg_block_direct_firm_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.firm_id is distinct from old.firm_id then
    raise exception 'Direct updates to profiles.firm_id are not allowed';
  end if;
  return new;
end;
$$;

drop trigger if exists block_direct_firm_change on profiles;
create trigger block_direct_firm_change
before update of firm_id on profiles
for each row execute function trg_block_direct_firm_change();

-- Auctions: enforce month within group & winner in same group
create or replace function trg_check_auction_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g_duration int;
  w_group_id bigint;
begin
  select duration into g_duration
    from groups
    where id = new.group_id and firm_id = new.firm_id;

  if g_duration is null then
    raise exception 'Group not found or cross-firm mismatch';
  end if;

  if new.month < 1 or new.month > g_duration then
    raise exception 'Auction month % out of [1, %]', new.month, g_duration;
  end if;

  if new.winner_id is not null then
    select group_id into w_group_id
      from members
      where id = new.winner_id and firm_id = new.firm_id;
    if w_group_id is distinct from new.group_id then
      raise exception 'Winner (id=%) is not in group (id=%)', new.winner_id, new.group_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists check_auction_consistency on auctions;
create trigger check_auction_consistency
before insert or update on auctions
for each row execute function trg_check_auction_consistency();

-- Payments: member must belong to group & month within duration
create or replace function trg_check_payment_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  g_duration int;
  m_group_id bigint;
begin
  select group_id into m_group_id
    from members
    where id = new.member_id and firm_id = new.firm_id;

  if m_group_id is distinct from new.group_id then
    raise exception 'Member (id=%) not in group (id=%)', new.member_id, new.group_id;
  end if;

  select duration into g_duration
    from groups
    where id = new.group_id and firm_id = new.firm_id;

  if g_duration is null then
    raise exception 'Group not found or cross-firm mismatch';
  end if;

  if new.month < 1 or new.month > g_duration then
    raise exception 'Payment month % out of [1, %]', new.month, g_duration;
  end if;

  return new;
end;
$$;

drop trigger if exists check_payment_consistency on payments;
create trigger check_payment_consistency
before insert or update on payments
for each row execute function trg_check_payment_consistency();

-- ── 5. AUTH HOOK: AUTO-CREATE PROFILE ON SIGNUP ─────────────
-- Security definer + pinned search_path; RLS insert policy allows this.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── 6. RPCs FOR INVITES (safe pre-login access) ─────────────

-- Public read for a single invite by id (doesn't expose all invites)
create or replace function public.get_invite(invite_id uuid)
returns invites
language sql
stable
security definer
set search_path = public
as $$
  select * from invites where id = invite_id
$$;

grant execute on function public.get_invite(uuid) to anon, authenticated;

-- Accept invite: attach current user to firm safely
create or replace function public.accept_invite(invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firm uuid;
  v_role text;
  v_expires timestamptz;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated to accept invite';
  end if;

  select firm_id, role, expires_at, status
  into v_firm, v_role, v_expires, v_status
  from invites
  where id = invite_id;

  if not found then
    raise exception 'Invite not found';
  end if;
  if v_status <> 'pending' then
    raise exception 'Invite is not pending';
  end if;
  if now() > v_expires then
    raise exception 'Invite expired';
  end if;

  update profiles
     set firm_id = v_firm,
         role    = coalesce(v_role, 'staff')
   where id = auth.uid();

  update invites
     set status = 'accepted',
         updated_at = now()
   where id = invite_id;
end;
$$;

grant execute on function public.accept_invite(uuid) to authenticated;

-- ── 7. AGGREGATE VIEW (optional) ────────────────────────────
create or replace view v_member_dues as
select
  p.firm_id,
  p.group_id,
  p.member_id,
  p.month,
  sum(p.amount)                  as amount_paid,
  coalesce(max(p.amount_due), 0) as amount_due,
  greatest(coalesce(max(p.amount_due), 0) - sum(p.amount), 0) as balance_due
from payments p
group by p.firm_id, p.group_id, p.member_id, p.month;

-- ── 8. POST-SETUP NOTES ─────────────────────────────────────
-- To grant yourself superadmin after you sign up through the app:
--   update profiles set role = 'superadmin' where id = '<your-auth-user-id>';

-- To seed minimal firm & owner (optional, run AFTER you have a user id):
-- insert into firms (name, slug, owner_id) values ('Kumari Chit Funds', 'kumari-chits', '<your-auth-user-id>') on conflict do nothing;
-- update profiles set firm_id = (select id from firms where slug='kumari-chits'), role='owner' where id='<your-auth-user-id>';