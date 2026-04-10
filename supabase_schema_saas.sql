-- ChitVault SaaS — Multi-Tenant Schema (v2.4 - Net Payout Persistence)
-- Safe to run in Supabase SQL Editor (idempotent)
-- ============================================================

-- ── 0. PREREQS & EXTENSIONS ─────────────────────────────────
create extension if not exists pgcrypto;
create extension if not exists moddatetime;
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
  address     text,
  phone       text,
  -- Branding / white-label (LEGACY - DEPRECATED)
  primary_color   text default '#2563eb',     -- hex colour (DEPRECATED: No longer used in UI)
  accent_color    text default '#1e40af',     -- hex colour (DEPRECATED: No longer used in UI)
  theme_id        text default 'theme1',      -- id from THEMES list (DEPRECATED: Fixed via Profile)
  color_profile   text default 'indigo',      -- indigo | emerald | violet | crimson | graphite
  logo_url        text,                        -- hosted image URL
  font            text default 'DM Sans',      -- Google Font name
  enabled_schemes text[] default array['DIVIDEND', 'ACCUMULATION'],
  created_at      timestamptz default now(),
  created_by      uuid references auth.users(id),
  updated_at      timestamptz default now(),
  updated_by      uuid references auth.users(id)
);


-- Migration: add branding columns if table already exists
alter table firms add column if not exists primary_color  text default '#2563eb';
alter table firms add column if not exists accent_color   text default '#1e40af';
alter table firms add column if not exists theme_id       text default 'theme1';
alter table firms add column if not exists color_profile  text default 'indigo';
alter table firms add column if not exists logo_url       text;
alter table firms add column if not exists font           text default 'DM Sans';
alter table firms add column if not exists register_token text unique;
alter table firms add column if not exists address        text;
alter table firms add column if not exists city           text;
alter table firms add column if not exists phone          text;
alter table firms add column if not exists enabled_schemes text[] default array['DIVIDEND', 'ACCUMULATION'];

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'firms_plan_chk') then
    alter table firms add constraint firms_plan_chk
      check (plan in ('trial','basic','pro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'firms_plan_status_chk') then
    alter table firms add constraint firms_plan_status_chk
      check (plan_status in ('active','suspended','cancelled'));
  end if;
end $$;

drop trigger if exists set_firms_updated_at on firms;
create trigger set_firms_updated_at
  before update on firms
  for each row execute procedure moddatetime(updated_at);

-- 1.2 PROFILES (firm_id is MANDATORY)
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  firm_id    uuid not null references firms(id) on delete cascade,
  full_name  text,
  role       text default 'staff',
  status     text default 'active',
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_chk') then
    alter table profiles add constraint profiles_role_chk
      check (role in ('owner','staff','superadmin'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_status_chk') then
    alter table profiles add constraint profiles_status_chk
      check (status in ('active', 'inactive'));
  end if;
end $$;

drop trigger if exists set_profiles_updated_at on profiles;
create trigger set_profiles_updated_at
  before update on profiles
  for each row execute procedure moddatetime(updated_at);

-- 1.3 GROUPS
create table if not exists groups (
  id                   bigint primary key generated always as identity,
  firm_id              uuid not null references firms(id) on delete cascade,
  name                 text not null,
  chit_value           numeric(12,2) not null,
  num_members          int not null,
  duration             int not null,
  monthly_contribution numeric(12,2) not null,
  start_date           date not null,
  status               text default 'active',
  -- Scheme Configuration
  auction_scheme       text default 'ACCUMULATION',    -- 'DIVIDEND' (Direct Share) or 'ACCUMULATION' (Surplus Model)
  accumulated_surplus  numeric(12,2) default 0.0,  -- Track saved bids for early closure
  created_at           timestamptz default now(),
  created_by           uuid references auth.users(id),
  updated_at           timestamptz default now(),
  updated_by           uuid references auth.users(id),
  constraint groups_status_chk check (status in ('active','paused','closed')),
  constraint groups_scheme_chk check (auction_scheme in ('DIVIDEND','ACCUMULATION')),
  constraint groups_nonneg_chk check (num_members > 0 and duration > 0 and chit_value >= 0 and monthly_contribution >= 0)
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'groups_firm_id_id_unique') then
    alter table groups add constraint groups_firm_id_id_unique unique (firm_id, id);
  end if;
end $$;

drop trigger if exists set_groups_updated_at on groups;
create trigger set_groups_updated_at
  before update on groups
  for each row execute procedure moddatetime(updated_at);

-- Migration: add scheme columns if table already exists
alter table groups add column if not exists auction_scheme       text default 'ACCUMULATION';
alter table groups add column if not exists accumulated_surplus  numeric(12,2) default 0.0;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'groups_scheme_chk') then
    alter table groups add constraint groups_scheme_chk
      check (auction_scheme in ('DIVIDEND','ACCUMULATION'));
  end if;
end $$;

-- 1.3.5 PERSONS (Registry of unique individuals)
create table if not exists persons (
  id               bigint primary key generated always as identity,
  firm_id          uuid not null references firms(id) on delete cascade,
  name             text not null,
  nickname         text,
  phone            text,
  address          text,
  created_at       timestamptz default now(),
  created_by       uuid references auth.users(id),
  updated_at       timestamptz default now(),
  updated_by       uuid references auth.users(id)
);

do $$ begin
  -- Drop the old constraint if it exists
  alter table persons drop constraint if exists persons_firm_phone_unique;
  
  if not exists (select 1 from pg_constraint where conname = 'persons_firm_identity_unique') then
    alter table persons add constraint persons_firm_identity_unique unique (firm_id, name, phone);
  end if;
end $$;

-- 1.4 MEMBERS (Chit group enrollments / Tickets)
create table if not exists members (
  id               bigint primary key generated always as identity,
  firm_id          uuid not null references firms(id) on delete cascade,
  person_id        bigint references persons(id) on delete cascade,
  group_id         bigint references groups(id) on delete cascade,
  ticket_no        int,
  status           text default 'active',
  exit_month       int,
  transfer_from_id bigint references members(id) on delete set null,
  contact_id       bigint references members(id) on delete set null,
  notes            text,
  created_at       timestamptz default now(),
  created_by       uuid references auth.users(id),
  updated_at       timestamptz default now(),
  updated_by       uuid references auth.users(id),
  constraint members_status_chk check (status in ('active','transferred','exited','defaulter','foreman'))
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'members_group_ticket_unique') then
    alter table members add constraint members_group_ticket_unique unique (group_id, ticket_no);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'members_firm_id_id_unique') then
    alter table members add constraint members_firm_id_id_unique unique (firm_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'members_group_firm_fk') then
    alter table members add constraint members_group_firm_fk
      foreign key (firm_id, group_id) references groups(firm_id, id) on delete cascade;
  end if;
end $$;

drop trigger if exists set_members_updated_at on members;
create trigger set_members_updated_at
  before update on members
  for each row execute procedure moddatetime(updated_at);

-- 1.5 AUCTIONS
create table if not exists auctions (
  id           bigint primary key generated always as identity,
  firm_id      uuid not null references firms(id) on delete cascade,
  group_id     bigint references groups(id) on delete cascade,
  month        int not null,
  auction_date date,
  winner_id    bigint references members(id) on delete set null,
  auction_discount numeric(12,2) not null,
  total_pot    numeric(12,2) not null,
  dividend     numeric(12,2) not null,
  net_payout   numeric(12,2) default 0.0,
  -- Payout Settlement
  is_payout_settled boolean default false,
  payout_date       date,
  payout_amount     numeric(12,2),
  payout_mode       text,                          -- Cash, UPI, Bank Transfer, Cheque
  payout_note       text,
  notes             text,
  status       text default 'confirmed',
  created_at   timestamptz default now(),
  created_by   uuid references auth.users(id),
  updated_at   timestamptz default now(),
  updated_by   uuid references auth.users(id),
  unique(firm_id, group_id, month),
  constraint auctions_amounts_nonneg_chk check (auction_discount >= 0 and total_pot >= 0 and dividend >= 0),
  constraint auctions_status_chk check (status in ('draft','confirmed'))
);

-- Migration: add net_payout & settlement columns to auctions
alter table auctions add column if not exists net_payout          numeric(12,2) default 0.0;
alter table auctions add column if not exists is_payout_settled   boolean default false;
alter table auctions add column if not exists payout_date        date;
alter table auctions add column if not exists payout_amount      numeric(12,2);
alter table auctions add column if not exists payout_mode        text;
alter table auctions add column if not exists payout_note        text;
alter table auctions add column if not exists notes              text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'auctions_group_firm_fk') then
    alter table auctions add constraint auctions_group_firm_fk
      foreign key (firm_id, group_id) references groups(firm_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'auctions_winner_firm_fk') then
    alter table auctions add constraint auctions_winner_firm_fk
      foreign key (firm_id, winner_id) references members(firm_id, id) on delete set null;
  end if;
end $$;

drop trigger if exists set_auctions_updated_at on auctions;
create trigger set_auctions_updated_at
  before update on auctions
  for each row execute procedure moddatetime(updated_at);

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
  payment_type text default 'full',
  amount_due   numeric(12,2) default 0,
  balance_due  numeric(12,2) default 0,
  collected_by uuid references auth.users(id) on delete set null default auth.uid(),
  note         text,
  created_at   timestamptz default now(),
  created_by   uuid references auth.users(id),
  updated_at   timestamptz default now(),
  updated_by   uuid references auth.users(id),
  constraint payments_amounts_nonneg_chk
    check (amount >= 0 and amount_due >= 0 and balance_due >= 0)
);

-- Remove old unique constraint to allow multiple partial payments per month
alter table payments
  drop constraint if exists payments_firm_id_member_id_group_id_month_key,
  drop constraint if exists payments_member_id_group_id_month_key;

-- Migration: add note to payments
alter table payments add column if not exists note text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'payments_group_firm_fk') then
    alter table payments add constraint payments_group_firm_fk
      foreign key (firm_id, group_id) references groups(firm_id, id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_member_firm_fk') then
    alter table payments add constraint payments_member_firm_fk
      foreign key (firm_id, member_id) references members(firm_id, id) on delete cascade;
  end if;
end $$;

drop trigger if exists set_payments_updated_at on payments;
create trigger set_payments_updated_at
  before update on payments
  for each row execute procedure moddatetime(updated_at);

-- 1.7 INVITES
create table if not exists invites (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references firms(id) on delete cascade,
  email       text not null,
  role        text default 'staff',
  invited_by  uuid references auth.users(id),
  status      text default 'pending',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  expires_at  timestamptz default (now() + interval '7 days'),
  full_name   text,
  unique(firm_id, email)
);

drop trigger if exists set_invites_updated_at on invites;
create trigger set_invites_updated_at
  before update on invites
  for each row execute procedure moddatetime(updated_at);

-- 1.8 DENOMINATIONS
create table if not exists denominations (
  id           bigint primary key generated always as identity,
  firm_id      uuid not null references firms(id) on delete cascade,
  entry_date   date not null default current_date,
  collected_by uuid references auth.users(id) on delete set null default auth.uid(),
  note_2000    int default 0, note_500  int default 0, note_200 int default 0,
  note_100     int default 0, note_50   int default 0, note_20  int default 0,
  note_10      int default 0, coin_5    int default 0, coin_2   int default 0,
  coin_1       int default 0,
  total        numeric generated always as (
    note_2000*2000 + note_500*500 + note_200*200 + note_100*100 +
    note_50*50 + note_20*20 + note_10*10 + coin_5*5 + coin_2*2 + coin_1*1
  ) stored,
  notes        text,
  created_at   timestamptz default now(),
  created_by   uuid references auth.users(id),
  updated_at   timestamptz default now(),
  updated_by   uuid references auth.users(id)
);

drop trigger if exists set_denominations_updated_at on denominations;
create trigger set_denominations_updated_at
  before update on denominations
  for each row execute procedure moddatetime(updated_at);

-- ── 2. INDEXES ────────────────────────────────────────────────
create index if not exists idx_groups_firm                 on groups(firm_id);
create index if not exists idx_members_firm                on members(firm_id);
create index if not exists idx_members_group               on members(group_id);
create index if not exists idx_auctions_firm               on auctions(firm_id);
create index if not exists idx_auctions_group_month        on auctions(group_id, month);
create index if not exists idx_payments_firm               on payments(firm_id);
create index if not exists idx_payments_member_month       on payments(firm_id, member_id, group_id, month);
create index if not exists idx_payments_group_month_member on payments(group_id, month, member_id);
create index if not exists idx_profiles_firm               on profiles(firm_id);
create index if not exists idx_denominations_firm_date     on denominations(firm_id, entry_date desc);

-- ── 3. RLS & HELPER FUNCTIONS ─────────────────────────────────
alter table firms         enable row level security;
alter table profiles      enable row level security;
alter table groups        enable row level security;
alter table members       enable row level security;
alter table auctions      enable row level security;
alter table payments      enable row level security;
alter table invites       enable row level security;
alter table denominations enable row level security;

create or replace function my_firm_id()
returns uuid language sql stable security definer set search_path = public as $$
  select firm_id from profiles where id = auth.uid() order by created_at desc limit 1
$$;

create or replace function is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'superadmin')
$$;

create or replace function is_firm_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and (role = 'owner' or role = 'superadmin')
  )
$$;

-- Drop all existing policies
do $pol$ declare r record; begin
  for r in select schemaname, tablename, policyname from pg_policies
    where tablename in ('firms','profiles','groups','persons','members','auctions','payments','invites','denominations','foreman_commissions')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $pol$;

-- FIRMS
create policy firms_select on firms for select
  using (owner_id = auth.uid() or id = my_firm_id() or is_superadmin());
create policy firms_insert on firms for insert
  with check (owner_id = auth.uid() or is_superadmin());
create policy firms_update on firms for update
  using (owner_id = auth.uid() or is_superadmin());

-- PROFILES: open insert for signup trigger; update only self or superadmin
create policy profiles_insert on profiles for insert to public
  with check (true);
create policy profiles_select on profiles for select
  using (id = auth.uid() or firm_id = my_firm_id() or is_superadmin());
create policy profiles_update on profiles for update
  using (id = auth.uid() or is_superadmin());

-- GROUPS: owner write, all firm members read
create policy groups_select on groups for select
  using (firm_id = my_firm_id() or is_superadmin());
create policy groups_insert on groups for insert
  with check ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());
create policy groups_update on groups for update
  using ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());
create policy groups_delete on groups for delete
  using ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());

-- PERSONS: owner+staff manage
alter table persons enable row level security;
create policy persons_select on persons for select
  using (firm_id = my_firm_id() or is_superadmin());
create policy persons_insert on persons for insert
  with check (firm_id = my_firm_id() or is_superadmin());
create policy persons_update on persons for update
  using (firm_id = my_firm_id() or is_superadmin());
create policy persons_delete on persons for delete
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

-- PAYMENTS: owner+staff insert; owner update/delete
create policy payments_select on payments for select
  using (firm_id = my_firm_id() or is_superadmin());
create policy payments_insert on payments for insert
  with check (firm_id = my_firm_id() or is_superadmin());
create policy payments_update on payments for update
  using ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());
create policy payments_delete on payments for delete
  using ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());

-- INVITES: owner manage
create policy invites_select on invites for select
  using (firm_id = my_firm_id() or is_superadmin());
create policy invites_insert on invites for insert
  with check (firm_id = my_firm_id());
create policy invites_update on invites for update
  using (firm_id = my_firm_id() or is_superadmin());
create policy invites_delete on invites for delete
  using (firm_id = my_firm_id() or is_superadmin());

-- DENOMINATIONS: owner+staff insert; owner delete
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
grant all on firms, profiles, groups, persons, members, auctions, payments, invites, denominations to authenticated;

-- ── 4. AUTH TRIGGER: DISABLED ──────────────────────────────
-- DISABLED: Profiles must be created with firm_id (NOT NULL).
-- Creation happens only in register_firm(), accept_invite(), or join_firm_by_token() RPCs.
-- This ensures users cannot exist without being assigned to a firm.
-- 
-- drop trigger if exists on_auth_user_created on auth.users;

-- ── 5. RPC: REGISTER FIRM (replaces direct upsert in app) ────
-- Called after Supabase auth signup. Creates firm + links profile in one tx.
create or replace function public.register_firm(
  p_name      text,
  p_slug      text,
  p_city      text default null,
  p_phone     text default null,
  p_full_name text default null
)
returns uuid   -- returns the new firm_id
language plpgsql
security definer
set search_path = public
as $$
declare
  v_firm_id uuid;
begin
  if not is_superadmin() then
    raise exception 'FORBIDDEN: Only platform superadmins can register new firms.';
  end if;

  -- Check slug available
  if exists (select 1 from firms where slug = p_slug) then
    raise exception 'SLUG_TAKEN';
  end if;

  -- Create firm
  insert into firms (name, slug, owner_id, city, phone, plan)
  values (p_name, p_slug, auth.uid(), p_city, p_phone, 'trial')
  returning id into v_firm_id;

  -- Create or link profile: insert if not exists, or update firm_id/role if does
  insert into profiles (id, firm_id, role, full_name)
  values (auth.uid(), v_firm_id, 'owner', p_full_name)
  on conflict (id) do update
  set firm_id   = v_firm_id,
      role      = 'owner',
      full_name = coalesce(p_full_name, profiles.full_name);

  return v_firm_id;
end;
$$;

grant execute on function public.register_firm(text,text,text,text,text) to authenticated;

-- Public RPC: get firm branding by slug (for login page)
create or replace function public.get_firm_branding(p_slug text)
returns table (
  name text, theme_id text, logo_url text,
  font text, plan_status text,
  color_profile text
)
language sql stable security definer set search_path = public as $$
  select name, theme_id, logo_url, font, plan_status, color_profile
  from firms where slug = p_slug
$$;
grant execute on function public.get_firm_branding(text) to anon, authenticated;

-- Public RPC: validate register token
create or replace function public.get_firm_by_register_token(p_token text)
returns table (id uuid, name text, slug text, theme_id text, logo_url text, color_profile text)
language sql stable security definer set search_path = public as $$
  select id, name, slug, theme_id, logo_url, color_profile
  from firms where register_token = p_token
$$;
grant execute on function public.get_firm_by_register_token(text) to anon, authenticated;


-- ── 6. RPC: ACCEPT INVITE ────────────────────────────────────
-- Called from invite accept page. Sets firm_id + role safely.
create or replace function public.accept_invite(invite_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_firm   uuid;
  v_role   text;
  v_expires timestamptz;
  v_status text;
  v_email  text;
  v_user_email text;
  v_full_name text;
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated';
  end if;

  select firm_id, role, expires_at, status, email, full_name
  into v_firm, v_role, v_expires, v_status, v_email, v_full_name
  from invites where id = invite_id;

  if not found then raise exception 'Invite not found'; end if;
  if v_status <> 'pending' then raise exception 'Invite already used or expired'; end if;
  if now() > v_expires then raise exception 'Invite link has expired'; end if;

  -- Verify the logged-in user's email matches the invite email
  select email into v_user_email from auth.users where id = auth.uid();
  if lower(v_user_email) <> lower(v_email) then
    raise exception 'This invite was sent to a different email address';
  end if;

  -- Create or link profile to the invited firm
  insert into profiles (id, firm_id, role, full_name)
  values (auth.uid(), v_firm, coalesce(v_role, 'staff'), v_full_name)
  on conflict (id) do update
  set firm_id   = v_firm, 
      role      = coalesce(v_role, 'staff'),
      full_name = coalesce(v_full_name, profiles.full_name);

  update invites set status = 'accepted' where id = invite_id;
end;
$$;

grant execute on function public.accept_invite(uuid) to authenticated;

-- ── 7. RPC: GET INVITE (public read for invite page) ─────────
drop function if exists public.get_invite(uuid);
create or replace function public.get_invite(invite_id uuid)
returns table (
  id uuid, firm_id uuid, email text, role text,
  status text, expires_at timestamptz, firm_name text, full_name text
)
language sql stable security definer set search_path = public as $$
  select i.id, i.firm_id, i.email, i.role, i.status, i.expires_at, f.name as firm_name, i.full_name
  from invites i
  join firms f on f.id = i.firm_id
  where i.id = invite_id
$$;

grant execute on function public.get_invite(uuid) to anon, authenticated;

-- ── 8. CONSISTENCY TRIGGERS ──────────────────────────────────

-- Prevent changing firm once assigned (but allow initial set from NULL)
create or replace function trg_block_firm_reassign()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Allow first-time assignment (old.firm_id is null = fresh profile from signup trigger)
  if old.firm_id is null then return new; end if;
  -- Block changing firm once assigned
  if new.firm_id is distinct from old.firm_id then
    raise exception 'Cannot change firm once assigned. Contact support.';
  end if;
  return new;
end;
$$;

drop trigger if exists block_firm_reassign on profiles;
drop trigger if exists block_direct_firm_change on profiles;
create trigger block_firm_reassign
  before update of firm_id on profiles
  for each row execute function trg_block_firm_reassign();

-- Auction consistency: month in range, winner in same group
create or replace function trg_check_auction_consistency()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  g_duration int; w_group_id bigint;
begin
  select duration into g_duration from groups
    where id = new.group_id and firm_id = new.firm_id;
  if g_duration is null then
    raise exception 'Group not found or firm mismatch';
  end if;
  if new.month < 1 or new.month > g_duration then
    raise exception 'Auction month % is out of range [1, %]', new.month, g_duration;
  end if;
  if new.winner_id is not null then
    select group_id into w_group_id from members
      where id = new.winner_id and firm_id = new.firm_id;
    if w_group_id is distinct from new.group_id then
      raise exception 'Winner is not a member of this group';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists check_auction_consistency on auctions;
create trigger check_auction_consistency
  before insert or update on auctions
  for each row execute function trg_check_auction_consistency();

-- Payment consistency: member belongs to group, month in range
create or replace function trg_check_payment_consistency()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  g_duration int; m_group_id bigint;
begin
  select group_id into m_group_id from members
    where id = new.member_id and firm_id = new.firm_id;
  if m_group_id is distinct from new.group_id then
    raise exception 'Member does not belong to this group';
  end if;
  select duration into g_duration from groups
    where id = new.group_id and firm_id = new.firm_id;
  if g_duration is null then
    raise exception 'Group not found or firm mismatch';
  end if;
  if new.month < 1 or new.month > g_duration then
    raise exception 'Payment month % is out of range [1, %]', new.month, g_duration;
  end if;
  return new;
end;
$$;

drop trigger if exists check_payment_consistency on payments;
create trigger check_payment_consistency
  before insert or update on payments
  for each row execute function trg_check_payment_consistency();

-- ── 9. UTILITY VIEW ──────────────────────────────────────────
create or replace view v_member_dues
with (security_invoker = true)
as
select
  p.firm_id, p.group_id, p.member_id, p.month,
  sum(p.amount)                  as amount_paid,
  coalesce(max(p.amount_due), 0) as amount_due,
  greatest(coalesce(max(p.amount_due), 0) - sum(p.amount), 0) as balance_due
from payments p
group by p.firm_id, p.group_id, p.member_id, p.month;

-- ── 10. POST-SETUP ───────────────────────────────────────────
-- Set yourself as superadmin after first sign-up:
--   update profiles set role = 'superadmin' where id = '<your-auth-user-id>';

-- ── join_firm_by_token RPC (for token-based staff registration) ──
create or replace function public.join_firm_by_token(p_token text, p_full_name text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_firm_id uuid;
begin
  if auth.uid() is null then raise exception 'Must be authenticated'; end if;

  select id into v_firm_id from firms where register_token = p_token;
  if not found then raise exception 'INVALID_TOKEN'; end if;

  -- Create or link profile: insert if not exists, or update firm_id/role if does
  insert into profiles (id, firm_id, role, full_name)
  values (auth.uid(), v_firm_id, 'staff', p_full_name)
  on conflict (id) do update
  set firm_id   = v_firm_id,
      role      = 'staff',
      full_name = coalesce(p_full_name, profiles.full_name);
end;
$$;
grant execute on function public.join_firm_by_token(text, text) to authenticated;

-- ── admin_create_firm RPC (superadmin creates firm for a client) ──
create or replace function public.admin_create_firm(
  p_name          text,
  p_slug          text,
  p_owner_id      uuid,
  p_owner_name    text default null,
  p_city          text default null,
  p_phone         text default null,
  p_plan          text default 'trial',
  p_color_profile text default 'indigo',
  p_font          text default 'DM Sans'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_firm_id uuid;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'superadmin') then
    raise exception 'Superadmin access required';
  end if;
bash
  if exists (select 1 from firms where slug = p_slug) then
    raise exception 'SLUG_TAKEN';
  end if;

  insert into firms (name, slug, owner_id, city, phone, plan, color_profile, font)
  values (p_name, p_slug, p_owner_id, p_city, p_phone, p_plan, p_color_profile, p_font)
  returning id into v_firm_id;

  -- Create or link profile immediately
  insert into profiles (id, firm_id, role, full_name)
  values (p_owner_id, v_firm_id, 'owner', p_owner_name)
  on conflict (id) do update
  set firm_id   = v_firm_id, 
      role      = 'owner',
      full_name = coalesce(p_owner_name, profiles.full_name);

  return v_firm_id;
end;
$$;
grant execute on function public.admin_create_firm(text,text,uuid,text,text,text,text,text,text) to authenticated;


-- ══════════════════════════════════════════════════════════════
-- 11. GLOBAL SOFT-DELETE (TRASH/ARCHIVE) - v2.5 (90-Day Retention)
-- ══════════════════════════════════════════════════════════════

-- ── Add deleted_at column to all primary entities ────────────
alter table groups        add column if not exists deleted_at timestamptz;
alter table members       add column if not exists deleted_at timestamptz;
alter table persons       add column if not exists deleted_at timestamptz;
alter table auctions      add column if not exists deleted_at timestamptz;
alter table payments      add column if not exists deleted_at timestamptz;
alter table settlements   add column if not exists deleted_at timestamptz;
alter table denominations add column if not exists deleted_at timestamptz;
alter table profiles      add column if not exists deleted_at timestamptz;

-- ── Create a periodic maintenance function ────────────────────
-- Purges records from the "Trash" that are older than 90 days.
-- Suggested execution: Cron job (pg_cron) or manual maintenance.
create or replace function public.purge_old_trash()
returns void 
language plpgsql 
security definer 
set search_path = public
as $$
begin
  -- Note: We only delete records that have a deleted_at timestamp older than 90 days.
  delete from public.payments      where deleted_at < now() - interval '90 days';
  delete from public.auctions      where deleted_at < now() - interval '90 days';
  delete from public.settlements   where deleted_at < now() - interval '90 days';
  delete from public.denominations where deleted_at < now() - interval '90 days';
  delete from public.members       where deleted_at < now() - interval '90 days';
  delete from public.persons       where deleted_at < now() - interval '90 days';
  delete from public.profiles      where deleted_at < now() - interval '90 days';
  delete from public.groups        where deleted_at < now() - interval '90 days';
end;
$$;

grant execute on function public.purge_old_trash() to authenticated;

-- ── Auction rules columns on groups table ────────────────────
alter table groups
  add column if not exists min_bid_pct            numeric(5,4) default 0.05,   -- 5% of chit_value
  add column if not exists max_bid_pct            numeric(5,4) default 0.40,   -- 40% of chit_value
  add column if not exists discount_cap_pct       numeric(5,4) default 0.40,   -- max discount as % of chit_value
  add column if not exists commission_type        text         default 'percent_of_chit',
  -- percent_of_chit | percent_of_discount | fixed_amount
  add column if not exists commission_value       numeric(12,2) default 5.00,
  -- if percent_of_chit:     5.00  → 5% of chit_value per month
  -- if percent_of_discount: 5.00  → 5% of discount
  -- if fixed_amount:        500   → ₹500 flat per month
  add column if not exists dividend_rule          text         default 'equal_split',
  -- equal_split | proportional (future use)
  add column if not exists commission_recipient   text         default 'foreman';
  -- foreman | firm (who gets the commission)

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'groups_commission_type_chk') then
    alter table groups add constraint groups_commission_type_chk
      check (commission_type in ('percent_of_chit','percent_of_discount','percent_of_payout','fixed_amount'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'groups_commission_recipient_chk') then
    alter table groups add constraint groups_commission_recipient_chk
      check (commission_recipient in ('foreman','firm'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'groups_bid_pct_chk') then
    alter table groups add constraint groups_bid_pct_chk
      check (min_bid_pct >= 0 and min_bid_pct <= 1 and max_bid_pct > 0 and max_bid_pct <= 1 and min_bid_pct <= max_bid_pct);
  end if;
end $$;

-- ── Foreman commissions table ─────────────────────────────────
-- One row per auction month per group — tracks foreman earnings
create table if not exists foreman_commissions (
  id              bigint primary key generated always as identity,
  firm_id         uuid not null references firms(id) on delete cascade,
  group_id        bigint not null references groups(id) on delete cascade,
  auction_id      bigint references auctions(id) on delete cascade,
  month           int not null,
  chit_value      numeric(12,2) not null,
  auction_discount numeric(12,2) not null,
  discount        numeric(12,2) not null,      -- redundant but kept for back-compat with old logic
  commission_type text not null,
  commission_rate numeric(12,4) not null,      -- % or fixed
  commission_amt  numeric(12,2) not null,      -- final ₹ commission
  net_dividend    numeric(12,2) not null,      -- discount - commission_amt
  per_member_div  numeric(12,2) not null,      -- net_dividend / num_members
  paid_to         text default 'foreman',      -- foreman | firm
  foreman_member_id bigint references members(id) on delete set null,
  notes           text,
  status          text default 'confirmed',
  created_at      timestamptz default now(),
  created_by      uuid references auth.users(id),
  updated_at      timestamptz default now(),
  updated_by      uuid references auth.users(id),
  unique(firm_id, group_id, month),
  constraint fc_status_chk check (status in ('draft','confirmed'))
);

alter table foreman_commissions enable row level security;
grant all on foreman_commissions to authenticated;
grant usage, select on sequence foreman_commissions_id_seq to authenticated;

create index if not exists idx_fc_firm_group on foreman_commissions(firm_id, group_id);

-- RLS: same firm isolation
create policy "fc_select" on foreman_commissions for select
  using (firm_id = my_firm_id() or is_superadmin());
create policy "fc_insert" on foreman_commissions for insert
  with check ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());
create policy "fc_update" on foreman_commissions for update
  using ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());
create policy "fc_delete" on foreman_commissions for delete
  using ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());

-- ── RPC: calculate_auction ───────────────────────────────────
-- Given a group + bid amount, returns the full breakdown
-- (bid limits enforced, commission deducted, dividend computed)
create or replace function public.calculate_auction(
  p_group_id  bigint,
  p_auction_discount numeric
)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  g            groups%rowtype;
  v_min_bid    numeric(12,2);
  v_max_bid    numeric(12,2);
  v_discount   numeric(12,2);
  v_cap        numeric(12,2);
  v_commission numeric(12,2);
  v_net_div    numeric(12,2);
  v_per_member numeric(12,2);
  v_num_members int;
  v_raw_payout numeric(12,2);
  v_net_payout numeric(12,2);
begin
  select * into g from groups where id = p_group_id and firm_id = my_firm_id();
  if not found then raise exception 'Group not found'; end if;

  -- Logic: p_auction_discount IS the Discount Amount (the amount bid "away")
  v_discount := p_auction_discount;
  v_raw_payout := g.chit_value - p_auction_discount;

  -- Enforce bid range (Now comparing discount against floor/cap)
  v_min_bid := round(g.chit_value * g.min_bid_pct, 2);
  v_max_bid := round(g.chit_value * g.max_bid_pct, 2);

  -- Enforce bid range
  if v_discount < v_min_bid then
    raise exception 'Auction discount ₹% is below minimum allowed ₹%', v_discount, v_min_bid;
  end if;
  if v_discount > v_max_bid then
    raise exception 'Auction discount ₹% exceeds maximum allowed ₹%', v_discount, v_max_bid;
  end if;

  -- Calculate foreman commission
  CASE g.commission_type
    WHEN 'percent_of_chit'     THEN v_commission := round(g.chit_value * g.commission_value / 100, 2);
    WHEN 'percent_of_discount' THEN v_commission := round(v_discount    * g.commission_value / 100, 2);
    WHEN 'percent_of_payout'   THEN v_commission := round(v_raw_payout * g.commission_value / 100, 2);
    WHEN 'fixed_amount'        THEN v_commission := g.commission_value;
    ELSE v_commission := 0;
  END CASE;

  -- Standard Logic: 
  -- 1. Winner takes Payout = Chit - Discount
  -- 2. Group gets Dividend = Discount - Commission
  v_net_payout := v_raw_payout; 
  v_net_div    := v_discount - v_commission;
  
  if v_net_div < 0 then v_net_div := 0; end if;

  if g.auction_scheme = 'ACCUMULATION' then
     v_per_member := 0;
  else
     -- Count active members
     select count(*) into v_num_members from members
     where group_id = p_group_id and firm_id = my_firm_id() and status in ('active','foreman');
     v_num_members := greatest(v_num_members, 1);
     v_per_member  := round(v_net_div / v_num_members, 2);
  end if;

  return jsonb_build_object(
    'chit_value',      g.chit_value,
    'auction_discount', p_auction_discount,
    'min_bid',         v_min_bid,
    'max_bid',         v_max_bid,
    'discount',        v_discount,
    'discount_cap',    v_cap,
    'commission_type', g.commission_type,
    'commission_rate', g.commission_value,
    'commission_amt',  v_commission,
    'commission_recipient', g.commission_recipient,
    'net_dividend',    v_net_div,
    'num_members',     v_num_members,
    'per_member_div',  v_per_member,
    'each_pays',       g.monthly_contribution - v_per_member,
    'net_payout',      v_net_payout
  );
end;
$$;

grant execute on function public.calculate_auction(bigint, numeric) to authenticated;

-- ── RPC: record_auction_with_commission ──────────────────────
-- Inserts auction + foreman_commission row atomically
create or replace function public.record_auction_with_commission(
  p_group_id      bigint,
  p_month         int,
  p_auction_date  date,
  p_winner_id     bigint,
  p_auction_discount numeric,
  p_foreman_member_id bigint default null,
  p_notes         text default null,
  p_status        text default 'confirmed',
  p_auction_id    bigint default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  g            groups%rowtype;
  v_calc       jsonb;
  v_auction_id bigint;
  v_old_auction auctions%rowtype;
  v_firm_id    uuid;
begin
  if not is_firm_owner() then
    raise exception 'Owner access required to record auctions';
  end if;

  select * into g from groups where id = p_group_id and firm_id = my_firm_id();
  if not found then raise exception 'Group not found'; end if;

  v_firm_id := my_firm_id();

  -- Get full calculation (also validates bid range)
  v_calc := public.calculate_auction(p_group_id, p_auction_discount);

  -- Handle Existing Auction (Edit Mode)
  if p_auction_id is not null then
    select * into v_old_auction from auctions where id = p_auction_id and firm_id = v_firm_id;
    if not found then raise exception 'Original auction record not found'; end if;

    -- Reverse old confirmed impact if present
    if v_old_auction.status = 'confirmed' and g.auction_scheme = 'ACCUMULATION' then
        update groups 
        set accumulated_surplus = accumulated_surplus - v_old_auction.auction_discount
        where id = p_group_id;
    end if;

    -- Update existing auction
    update auctions set
      auction_date = p_auction_date,
      winner_id = p_winner_id,
      auction_discount = p_auction_discount,
      total_pot = g.chit_value,
      dividend = (v_calc->>'per_member_div')::numeric,
      net_payout = (v_calc->>'net_payout')::numeric,
      status = p_status,
      updated_at = now()
    where id = p_auction_id;
    
    v_auction_id := p_auction_id;

    -- Update or Delete Foreman Commission
    -- We can just delete and let it recreate to ensure all fields are fresh
    delete from foreman_commissions where auction_id = v_auction_id;
  else
    -- Standard Insert Mode
    insert into auctions (firm_id, group_id, month, auction_date, winner_id, auction_discount, total_pot, dividend, net_payout, status)
    values (
      v_firm_id, p_group_id, p_month, p_auction_date, p_winner_id,
      p_auction_discount, g.chit_value, (v_calc->>'per_member_div')::numeric, (v_calc->>'net_payout')::numeric, p_status
    )
    returning id into v_auction_id;
  end if;

  -- Insert foreman commission record (Fresh row)
  insert into foreman_commissions (
    firm_id, group_id, auction_id, month,
    chit_value, auction_discount, discount,
    commission_type, commission_rate, commission_amt,
    net_dividend, per_member_div,
    paid_to, foreman_member_id, notes, status
  ) values (
    v_firm_id, p_group_id, v_auction_id, p_month,
    g.chit_value, p_auction_discount, (v_calc->>'discount')::numeric,
    (v_calc->>'commission_type')::text,
    (v_calc->>'commission_rate')::numeric,
    (v_calc->>'commission_amt')::numeric,
    (v_calc->>'net_dividend')::numeric,
    (v_calc->>'per_member_div')::numeric,
    g.commission_recipient,
    p_foreman_member_id,
    p_notes,
    p_status
  );

  -- Apply confirmed impact if status is confirmed
  if p_status = 'confirmed' and g.auction_scheme = 'ACCUMULATION' then
     update groups 
     set accumulated_surplus = accumulated_surplus + p_auction_discount
     where id = p_group_id;
  end if;

  return v_calc || jsonb_build_object('auction_id', v_auction_id);
end;
$$;

grant execute on function public.record_auction_with_commission(bigint,int,date,bigint,numeric,bigint,text) to authenticated;

-- ── 9. ACTIVITY LOGS (Audit Trail) ──────────────────────────
create table if not exists activity_logs (
  id           bigint primary key generated always as identity,
  firm_id      uuid not null references firms(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  action       text not null,
  entity_type  text,
  entity_id    text,
  metadata     jsonb,
  created_at   timestamptz default now()
);

alter table activity_logs enable row level security;
grant all on activity_logs to authenticated;

create index if not exists idx_activity_logs_firm_date on activity_logs(firm_id, created_at desc);

create policy activity_logs_select on activity_logs for select
  using (firm_id = my_firm_id() or is_superadmin());
create policy activity_logs_insert on activity_logs for insert
  with check (firm_id = my_firm_id() or is_superadmin());
-- ══════════════════════════════════════════════════════════════
-- SUPERADMIN COMMAND CENTER: GLOBAL ACTIVITY TRACKING
-- ══════════════════════════════════════════════════════════════

-- ── admin_activity table ────────────────────────────────────
create table if not exists admin_activity (
  id          bigint primary key generated always as identity,
  event_type  text not null, -- 'firm_created', 'plan_changed', 'status_suspended', etc.
  details     jsonb default '{}',
  firm_id     uuid references firms(id) on delete set null,
  created_at  timestamptz default now()
);

alter table admin_activity enable row level security;
create policy admin_activity_select on admin_activity for select
  using (is_superadmin());

-- ── Trigger: Log New Firm Registration ───────────────────────
create or replace function trg_log_new_firm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into admin_activity (event_type, details, firm_id)
  values ('firm_created', jsonb_build_object(
    'name', new.name,
    'city', new.city,
    'plan', new.plan
  ), new.id);
  return new;
end;
$$;

drop trigger if exists log_new_firm on firms;
create trigger log_new_firm
  after insert on firms
  for each row execute function trg_log_new_firm();

-- ══════════════════════════════════════════════════════════════
-- 12. PERFORMANCE OPTIMIZATIONS (Aggregated Metrics & Scoped Fetching)
-- ══════════════════════════════════════════════════════════════

-- 12.1 Registry Statistics (Members Page)
create or replace function public.get_firm_registry_stats(p_firm_id uuid)
returns json 
language plpgsql 
security definer 
set search_path = public
as $$
declare
    v_total_people int;
    v_active_tickets int;
begin
    select count(*) into v_total_people from persons where firm_id = p_firm_id and deleted_at is null;
    select count(m.id) into v_active_tickets from members m join groups g on m.group_id = g.id
    where m.firm_id = p_firm_id and m.deleted_at is null and g.status != 'archived';
    return json_build_object('totalPeople', v_total_people, 'activeTickets', v_active_tickets);
end;
$$;

-- 12.2 Ledger Statistics (Payments & Cashbook Page)
create or replace function public.get_firm_ledger_stats(p_firm_id uuid, p_start_date date default null, p_end_date date default null)
returns json 
language plpgsql 
security definer 
set search_path = public
as $$
declare
    v_today_coll numeric(12,2);
    v_range_coll numeric(12,2) := 0;
    v_range_payout numeric(12,2) := 0;
begin
    select coalesce(sum(amount), 0) into v_today_coll from payments where firm_id = p_firm_id and deleted_at is null and payment_date = current_date;
    if p_start_date is not null and p_end_date is not null then
        select coalesce(sum(amount), 0) into v_range_coll from payments where firm_id = p_firm_id and deleted_at is null and payment_date >= p_start_date and payment_date <= p_end_date;
        select coalesce(sum(total_amount), 0) into v_range_payout from settlements where firm_id = p_firm_id and deleted_at is null and created_at >= (p_start_date::text || ' 00:00:00')::timestamp and created_at <= (p_end_date::text || ' 23:59:59')::timestamp;
    end if;
    return json_build_object('collectedToday', v_today_coll, 'collectedInRange', v_range_coll, 'payoutsInRange', v_range_payout);
end;
$$;

-- 12.3 Dashboard Statistics
create or replace function public.get_firm_dashboard_stats(p_firm_id uuid)
returns json 
language plpgsql 
security definer 
set search_path = public
as $$
declare
    v_total_chit_value numeric(15,2);
    v_defaulters_count int;
    v_active_groups_count int;
    v_total_members_count int;
begin
    select coalesce(sum(chit_value), 0), count(*) into v_total_chit_value, v_active_groups_count from groups where firm_id = p_firm_id and status = 'active' and deleted_at is null;
    select count(*) into v_defaulters_count from members where firm_id = p_firm_id and status = 'defaulter' and deleted_at is null;
    select count(*) into v_total_members_count from members where firm_id = p_firm_id and deleted_at is null;
    return json_build_object('totalChitValue', v_total_chit_value, 'defaulters', v_defaulters_count, 'activeGroups', v_active_groups_count, 'totalMembers', v_total_members_count);
end;
$$;

-- 12.4 Collection Trends (6 Months)
create or replace function public.get_firm_collection_trends(p_firm_id uuid)
returns json 
language plpgsql 
security definer 
set search_path = public
as $$
begin
    return (select json_agg(t) from (select to_char(payment_date, 'YYYY-MM') as month, coalesce(sum(amount), 0) as actual from payments where firm_id = p_firm_id and deleted_at is null and payment_date >= (current_date - interval '6 months') group by 1 order by 1) t);
end;
$$;

-- 12.5 Group Progress Summaries
create or replace function public.get_firm_group_summaries(p_firm_id uuid)
returns json 
language plpgsql 
security definer 
set search_path = public
as $$
begin
    return (select json_agg(t) from (select g.id, (select count(*) from auctions a where a.group_id = g.id and a.status = 'confirmed' and a.deleted_at is null) as auctions_done, (select count(*) from payments p where p.group_id = g.id and p.status = 'paid' and p.deleted_at is null) as payments_made from groups g where g.firm_id = p_firm_id and g.status != 'archived' and g.deleted_at is null) t);
end;
$$;

-- 12.6 Winner Intelligence
create or replace function public.get_firm_winner_insights(p_firm_id uuid)
returns json 
language plpgsql 
security definer 
set search_path = public
as $$
declare
    v_early_bird_count int;
    v_highest_bid numeric(15,2);
begin
    select count(*) into v_early_bird_count from auctions a join groups g on a.group_id = g.id where a.firm_id = p_firm_id and a.status = 'confirmed' and a.month <= (g.duration / 4);
    select coalesce(max(auction_discount), 0) into v_highest_bid from auctions where firm_id = p_firm_id and status = 'confirmed';
    return json_build_object('earlyBirdCount', v_early_bird_count, 'highestSingleDiscount', v_highest_bid);
end;
$$;

grant execute on function public.get_firm_registry_stats(uuid) to authenticated;
grant execute on function public.get_firm_ledger_stats(uuid, date, date) to authenticated;
grant execute on function public.get_firm_dashboard_stats(uuid) to authenticated;
grant execute on function public.get_firm_collection_trends(uuid) to authenticated;
grant execute on function public.get_firm_group_summaries(uuid) to authenticated;
grant execute on function public.get_firm_winner_insights(uuid) to authenticated;
