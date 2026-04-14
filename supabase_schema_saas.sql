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
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  owner_id        uuid references auth.users(id) on delete set null,
  plan            text default 'trial',
  plan_status     text default 'active',
  trial_ends      timestamptz default (now() + interval '30 days'),
  invoice_ref     text,
  city            text,
  address         text,
  phone           text,
  color_profile   text default 'indigo',      -- indigo | emerald | violet | crimson | graphite
  logo_url        text,                        -- hosted image URL
  font            text default 'DM Sans',      -- Google Font name
  register_token  text unique,
  enabled_schemes text[] default array['DIVIDEND', 'ACCUMULATION'],
  created_at      timestamptz default now(),
  created_by      uuid references auth.users(id),
  updated_at      timestamptz default now(),
  updated_by      uuid references auth.users(id),
  constraint firms_plan_chk check (plan in ('trial','basic','pro')),
  constraint firms_plan_status_chk check (plan_status in ('active','suspended','cancelled'))
);

drop trigger if exists set_firms_updated_at on firms;
create trigger set_firms_updated_at
  before update on firms
  for each row execute procedure moddatetime(updated_at);

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
  accumulated_surplus  numeric(12,2) default 0.0,      -- Track saved bids for early closure
  -- Bidding & Commission Rules
  min_bid_pct          numeric(12,4) default 0.0500,   -- 5% of chit_value
  max_bid_pct          numeric(12,4) default 0.4000,   -- 40% of chit_value
  discount_cap_pct     numeric(12,4) default 0.4000,   -- max discount cap
  commission_type      text default 'percent_of_chit', -- percent_of_chit | percent_of_discount | fixed_amount
  commission_value     numeric(12,2) default 5.00,
  dividend_rule        text default 'equal_split',     -- equal_split | proportional
  commission_recipient text default 'foreman',          -- foreman | firm
  created_at           timestamptz default now(),
  created_by           uuid references auth.users(id),
  updated_at           timestamptz default now(),
  updated_by           uuid references auth.users(id),
  deleted_at           timestamptz,
  constraint groups_status_chk check (status in ('active','paused','closed')),
  constraint groups_scheme_chk check (auction_scheme in ('DIVIDEND','ACCUMULATION')),
  constraint groups_comm_type_chk check (commission_type in ('percent_of_chit','percent_of_discount','percent_of_payout','fixed_amount')),
  constraint groups_comm_recp_chk check (commission_recipient in ('foreman','firm')),
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
  updated_by       uuid references auth.users(id),
  deleted_at       timestamptz,
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
  deleted_at       timestamptz,
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
  deleted_at   timestamptz,
  unique(firm_id, group_id, month),
  constraint auctions_amounts_nonneg_chk check (auction_discount >= 0 and total_pot >= 0 and dividend >= 0),
  constraint auctions_status_chk check (status in ('draft','confirmed'))
);

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
  deleted_at   timestamptz,
  constraint payments_amounts_nonneg_chk
    check (amount >= 0 and amount_due >= 0 and balance_due >= 0)
);

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

-- 1.9 SETTLEMENTS (Member payout history)
create table if not exists settlements (
  id                bigint primary key generated always as identity,
  firm_id           uuid not null references firms(id) on delete cascade,
  member_id         bigint references members(id) on delete cascade,
  group_id          bigint references groups(id) on delete cascade,
  total_amount      numeric(12,2) not null default 0,
  total_months      int not null default 1,
  average_per_month numeric(12,2) not null default 0,
  month_14_balance  numeric(12,2) not null default 0,
  entries           jsonb not null default '[]'::jsonb,
  notes             text,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id) on delete set null,
  deleted_at        timestamptz
);

-- 1.10 FOREMAN COMMISSIONS
create table if not exists foreman_commissions (
  id              bigint primary key generated always as identity,
  firm_id         uuid not null references firms(id) on delete cascade,
  group_id        bigint not null references groups(id) on delete cascade,
  auction_id      bigint references auctions(id) on delete cascade,
  month           int not null,
  chit_value      numeric(12,2) not null,
  auction_discount numeric(12,2) not null,
  discount        numeric(12,2) not null,
  commission_type text not null,
  commission_rate numeric(12,4) not null,
  commission_amt  numeric(12,2) not null,
  net_dividend    numeric(12,2) not null,
  per_member_div  numeric(12,2) not null,
  paid_to         text default 'foreman',
  foreman_member_id bigint references members(id) on delete set null,
  notes           text,
  status          text default 'confirmed',
  created_at      timestamptz default now(),
  created_by      uuid references auth.users(id),
  updated_at      timestamptz default now(),
  updated_by      uuid references auth.users(id),
  deleted_at      timestamptz,
  unique(firm_id, group_id, month),
  constraint fc_status_chk check (status in ('draft','confirmed'))
);

-- 1.11 ACTIVITY LOGS (Audit Trail)
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

-- 1.12 ADMIN ACTIVITY (Superadmin only)
create table if not exists admin_activity (
  id          bigint primary key generated always as identity,
  event_type  text not null,
  details     jsonb default '{}',
  firm_id     uuid references firms(id) on delete set null,
  created_at  timestamptz default now()
);

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
create index if not exists idx_fc_firm_group               on foreman_commissions(firm_id, group_id);
create index if not exists idx_activity_logs_firm_date     on activity_logs(firm_id, created_at desc);
create index if not exists idx_settlements_member          on settlements(member_id);

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

-- ── 9. MAINTENANCE ─────────────────────────────────────────
-- Purges records from the "Trash" that are older than 90 days.
create or replace function public.purge_old_trash()
returns void language plpgsql security definer set search_path = public as $$
begin
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
    return (
        select json_agg(t) from (
            with top_groups as (
                select group_id, sum(amount) as vol
                from payments
                where firm_id = p_firm_id 
                  and deleted_at is null 
                  and payment_date >= (current_date - interval '6 months')
                group by 1
                order by 2 desc
                limit 10
            )
            select 
                to_char(p.payment_date, 'YYYY-MM') as month,
                g.name as group_name,
                coalesce(sum(p.amount), 0) as actual
            from payments p
            join groups g on p.group_id = g.id
            where p.group_id in (select group_id from top_groups)
              and p.firm_id = p_firm_id 
              and p.deleted_at is null 
              and p.payment_date >= (current_date - interval '6 months')
            group by 1, 2
            order by 1, 2
        ) t
    );
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
    return (
        select json_agg(t) from (
            select 
                g.id,
                (select count(*) from auctions a where a.group_id = g.id and a.status = 'confirmed' and a.deleted_at is null) as auctions_done,
                (
                    select json_build_object(
                        'winner', p.name,
                        'discount', a.auction_discount,
                        'month', a.month
                    )
                    from auctions a
                    join members m on a.winner_id = m.id
                    join persons p on m.person_id = p.id
                    where a.group_id = g.id and a.status = 'confirmed' and a.deleted_at is null
                    order by a.month desc
                    limit 1
                ) as last_auction
            from groups g 
            where g.firm_id = p_firm_id 
              and g.status != 'archived' 
              and g.deleted_at is null
        ) t
    );
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
    -- 1. Early Bird Count (Auctions in first 25% of duration)
    select count(*) into v_early_bird_count
    from auctions a
    join groups g on a.group_id = g.id
    where a.firm_id = p_firm_id 
      and a.status = 'confirmed' 
      and a.month <= (g.duration / 4);

    -- 2. Single Highest Bid
    select coalesce(max(auction_discount), 0) into v_highest_bid
    from auctions
    where firm_id = p_firm_id and status = 'confirmed' and deleted_at is null;

    return json_build_object(
        'earlyBirdCount', v_early_bird_count,
        'highestSingleDiscount', v_highest_bid,
        'topBorrower', (
            select json_build_object(
                'name', p.name,
                'totalDiscount', sum(a.auction_discount)
            )
            from auctions a
            join members m on a.winner_id = m.id
            join persons p on m.person_id = p.id
            where a.firm_id = p_firm_id 
              and a.status = 'confirmed' 
              and a.deleted_at is null
            group by p.name
            order by sum(a.auction_discount) desc
            limit 1
        )
    );
end;
$$;

grant execute on function public.get_firm_registry_stats(uuid) to authenticated;
grant execute on function public.get_firm_ledger_stats(uuid, date, date) to authenticated;
grant execute on function public.get_firm_dashboard_stats(uuid) to authenticated;
grant execute on function public.get_firm_collection_trends(uuid) to authenticated;
grant execute on function public.get_firm_group_summaries(uuid) to authenticated;
grant execute on function public.get_firm_winner_insights(uuid) to authenticated;
-- Migration: 013_fix_auction_payout_logic.sql
-- Goal: Update calculate_auction to handle different auction schemes correctly and persist net_payout.

DROP FUNCTION IF EXISTS public.calculate_auction(bigint, numeric, text, numeric, text);

CREATE OR REPLACE FUNCTION public.calculate_auction(
  p_group_id bigint,
  p_bid_amount numeric, -- The amount entered by the user (Winning Bid or Discount Bid)
  p_comm_type text DEFAULT NULL,
  p_comm_val numeric DEFAULT NULL,
  p_comm_recipient text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_group record;
  v_comm_amt numeric;
  v_raw_payout numeric;
  v_discount numeric;
  v_eff_type text;
  v_eff_val numeric;
  v_eff_recipient text;
  v_net_div_pool numeric;
  v_per_member_div numeric;
BEGIN
  SELECT * INTO v_group FROM groups WHERE id = p_group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found'; END IF;

  -- 1. Determine Payout & Discount based on scheme
  IF v_group.auction_scheme = 'DIVIDEND' THEN
    -- Dividend (Normal): User enters the Winning Bid (what the member takes)
    v_raw_payout := p_bid_amount;
    v_discount   := v_group.chit_value - p_bid_amount;
  ELSE 
    -- Accumulation: User enters the Discount Bid (what stays with the firm/group)
    v_raw_payout := v_group.chit_value - p_bid_amount;
    v_discount   := p_bid_amount;
  END IF;

  -- 2. Resolve Commission settings (overrides or group defaults)
  v_eff_type      := COALESCE(p_comm_type, v_group.commission_type);
  v_eff_val       := COALESCE(p_comm_val, v_group.commission_value);
  v_eff_recipient := COALESCE(p_comm_recipient, v_group.commission_recipient);

  -- 3. Calculate Commission
  IF v_eff_type = 'percent_of_chit' THEN
    v_comm_amt := (v_group.chit_value * v_eff_val) / 100;
  ELSIF v_eff_type = 'percent_of_discount' THEN
    v_comm_amt := (v_discount * v_eff_val) / 100;
  ELSIF v_eff_type = 'percent_of_payout' THEN
    v_comm_amt := (v_raw_payout * v_eff_val) / 100;
  ELSIF v_eff_type = 'fixed_amount' THEN
    v_comm_amt := v_eff_val;
  ELSE
    v_comm_amt := (v_group.chit_value * 5) / 100; 
  END IF;

  v_comm_amt := round(v_comm_amt, 2);
  
  -- 4. Dividend calculation
  IF v_group.auction_scheme = 'DIVIDEND' THEN
    v_net_div_pool := v_discount - v_comm_amt;
    IF v_net_div_pool < 0 THEN v_net_div_pool := 0; END IF;
    v_per_member_div := round(v_net_div_pool / v_group.num_members, 2);
  ELSE 
    -- Accumulation groups don't pay immediate dividends
    v_net_div_pool := 0;
    v_per_member_div := 0;
  END IF;

  RETURN json_build_object(
    'chit_value',           v_group.chit_value,
    'auction_discount',     v_discount,
    'commission_type',      v_eff_type,
    'commission_rate',      v_eff_val,
    'commission_amt',       v_comm_amt,
    'commission_recipient', v_eff_recipient,
    'net_dividend',         v_net_div_pool,
    'per_member_div',       v_per_member_div,
    'each_pays',            v_group.monthly_contribution - v_per_member_div,
    'net_payout',           v_raw_payout - v_comm_amt, -- Payout is net of commission
    'raw_payout',           v_raw_payout,
    'auction_scheme',       v_group.auction_scheme
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update record_auction_with_commission to use the new calculator results correctly
CREATE OR REPLACE FUNCTION public.record_auction_with_commission(
  p_group_id bigint,
  p_month int,
  p_auction_date date,
  p_winner_id bigint,
  p_bid_amount numeric, -- Entered amount
  p_foreman_member_id bigint,
  p_notes text,
  p_status text,
  p_auction_id bigint DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_firm_id uuid;
  v_auction_id bigint;
  v_calc json;
  g record;
BEGIN
  SELECT * INTO g FROM groups WHERE id = p_group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found'; END IF;
  
  v_firm_id := g.firm_id;
  
  -- Calculate using the corrected logic
  SELECT calculate_auction(p_group_id, p_bid_amount) INTO v_calc;

  IF p_auction_id IS NOT NULL THEN
    v_auction_id := p_auction_id;
    UPDATE auctions SET
      auction_date = p_auction_date,
      winner_id = p_winner_id,
      auction_discount = (v_calc->>'auction_discount')::numeric,
      total_pot = (v_calc->>'chit_value')::numeric,
      dividend = (v_calc->>'per_member_div')::numeric,
      net_payout = (v_calc->>'net_payout')::numeric,
      status = p_status,
      notes = p_notes,
      updated_at = now()
    WHERE id = v_auction_id;
    
    DELETE FROM foreman_commissions WHERE auction_id = v_auction_id;
  ELSE
    INSERT INTO auctions (firm_id, group_id, month, auction_date, winner_id, auction_discount, total_pot, dividend, net_payout, status, notes)
    VALUES (
      v_firm_id, p_group_id, p_month, p_auction_date, p_winner_id,
      (v_calc->>'auction_discount')::numeric, (v_calc->>'chit_value')::numeric, 
      (v_calc->>'per_member_div')::numeric, (v_calc->>'net_payout')::numeric, p_status, p_notes
    ) RETURNING id INTO v_auction_id;
  END IF;

  INSERT INTO foreman_commissions (
    firm_id, group_id, auction_id, month,
    chit_value, auction_discount, discount,
    commission_type, commission_rate, commission_amt,
    net_dividend, per_member_div, paid_to, foreman_member_id, notes, status
  ) VALUES (
    v_firm_id, p_group_id, v_auction_id, p_month,
    g.chit_value, (v_calc->>'auction_discount')::numeric, p_bid_amount,
    (v_calc->>'commission_type')::text, (v_calc->>'commission_rate')::numeric, (v_calc->>'commission_amt')::numeric,
    (v_calc->>'net_dividend')::numeric, (v_calc->>'per_member_div')::numeric, 
    (v_calc->>'commission_recipient')::text, p_foreman_member_id, p_notes, p_status
  );

  -- Update accumulated surplus for ACCUMULATION groups
  UPDATE groups g_upd
  SET accumulated_surplus = (
    SELECT COALESCE(SUM(a.auction_discount - c.commission_amt), 0)
    FROM auctions a
    JOIN foreman_commissions c ON c.auction_id = a.id
    WHERE a.group_id = p_group_id 
      AND a.status = 'confirmed' 
      AND c.status = 'confirmed'
  )
  WHERE id = p_group_id AND g_upd.auction_scheme = 'ACCUMULATION';

  RETURN json_build_object('auction_id', v_auction_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Migration: 014_fix_dividend_attribution.sql
-- Goal: Fix the off-by-one error where dividends were applied to the same month as the auction.
-- Dividends from Auction Month M must reduce the amount_due for Month M+1.

CREATE OR REPLACE FUNCTION public.get_collection_workspace(
  p_firm_id uuid,
  p_search text DEFAULT '',
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  person_id bigint,
  person_name text,
  person_phone text,
  person_address text,
  total_balance numeric,
  overdue_count int,
  is_overdue boolean,
  memberships jsonb,
  total_count bigint
) AS $$
DECLARE
  v_total_count bigint;
BEGIN
  -- 1. Get total count for pagination
  SELECT COUNT(DISTINCT p.id) INTO v_total_count
  FROM persons p
  JOIN members m ON m.person_id = p.id
  WHERE p.firm_id = p_firm_id
    AND m.deleted_at IS NULL
    AND (p.name ILIKE '%' || p_search || '%' OR p.phone ILIKE '%' || p_search || '%');

  RETURN QUERY
  WITH person_list AS (
    -- Get paginated list of persons
    SELECT p.id, p.name, p.phone, p.address
    FROM persons p
    JOIN members m ON m.person_id = p.id
    WHERE p.firm_id = p_firm_id
      AND m.deleted_at IS NULL
      AND (p.name ILIKE '%' || p_search || '%' OR p.phone ILIKE '%' || p_search || '%')
    GROUP BY p.id
    ORDER BY p.name ASC
    LIMIT p_limit OFFSET p_offset
  ),
  membership_financials AS (
    -- Calculate dues for each membership of these persons
    SELECT 
      m.id as member_id,
      m.person_id,
      m.group_id,
      g.name as group_name,
      g.auction_scheme,
      g.monthly_contribution,
      -- Get latest auction month
      COALESCE((SELECT MAX(month) FROM auctions WHERE group_id = m.group_id AND status = 'confirmed'), 0) as latest_month,
      -- Total paid ever for this membership
      COALESCE((SELECT SUM(amount) FROM payments WHERE member_id = m.id AND group_id = m.group_id AND deleted_at IS NULL), 0) as total_paid
    FROM members m
    JOIN groups g ON g.id = m.group_id
    WHERE m.person_id IN (SELECT id FROM person_list)
      AND m.deleted_at IS NULL
  ),
  detailed_dues AS (
    -- Calculate specific months due
    SELECT 
      mf.member_id,
      mf.person_id,
      mf.group_id,
      mf.group_name,
      mf.total_paid,
      mf.latest_month,
      mf.monthly_contribution,
      mf.auction_scheme,
      (
        SELECT jsonb_agg(d) FROM (
          SELECT 
            gs.m as month,
            -- FIX: amount_due for month M is (Contribution - Dividend of Month M-1)
            mf.monthly_contribution - COALESCE(
              (SELECT a.per_member_div 
               FROM foreman_commissions a 
               WHERE a.group_id = mf.group_id AND a.month = gs.m - 1 AND a.status = 'confirmed'
              ), 0
            ) as amount_due,
            (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE member_id = mf.member_id AND month = gs.m AND deleted_at IS NULL) as amount_paid,
            (SELECT status FROM auctions WHERE group_id = mf.group_id AND month = gs.m) as auction_status
          FROM generate_series(1, mf.latest_month + 1) gs(m)
          WHERE gs.m <= (SELECT duration FROM groups WHERE id = mf.group_id)
        ) d
        WHERE d.amount_paid < (d.amount_due - 0.01)
      ) as pending_months
    FROM membership_financials mf
  ),
  aggregated_memberships AS (
    -- Aggregate memberships back to persons
    SELECT 
      dd.person_id,
      SUM(
        COALESCE((SELECT SUM(amount_due - amount_paid) FROM jsonb_to_recordset(dd.pending_months) as x(month int, amount_due numeric, amount_paid numeric)), 0)
      ) as total_person_balance,
      MAX(
        COALESCE((SELECT COUNT(*) FROM jsonb_to_recordset(dd.pending_months) as x(month int, status text) WHERE x.status = 'confirmed'), 0)::int
      ) as overdue_months_count,
      jsonb_agg(jsonb_build_object(
        'member', (SELECT row_to_json(m) FROM members m WHERE m.id = dd.member_id),
        'group', (SELECT row_to_json(g) FROM groups g WHERE g.id = dd.group_id),
        'totalBalance', COALESCE((SELECT SUM(amount_due - amount_paid) FROM jsonb_to_recordset(dd.pending_months) as x(month int, amount_due numeric, amount_paid numeric)), 0),
        'dues', dd.pending_months
      )) as membership_data
    FROM detailed_dues dd
    GROUP BY dd.person_id
  )
  SELECT 
    pl.id,
    pl.name,
    pl.phone,
    pl.address,
    COALESCE(am.total_person_balance, 0),
    COALESCE(am.overdue_months_count, 0),
    COALESCE(am.total_person_balance, 0) > 0.01,
    COALESCE(am.membership_data, '[]'::jsonb),
    v_total_count
  FROM person_list pl
  LEFT JOIN aggregated_memberships am ON am.person_id = pl.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Migration: 009_recalculate_ledger_logic.sql
-- Goal: Provide a way to retroactively update all auction records when group rules change.

CREATE OR REPLACE FUNCTION public.recalculate_group_ledger(p_group_id bigint)
RETURNS json AS $$
DECLARE
  r record;
  v_calc json;
  v_group record;
  v_bid_to_use numeric;
BEGIN
  SELECT * INTO v_group FROM groups WHERE id = p_group_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found'; END IF;

  -- 1. Loop through all confirmed auctions for this group
  FOR r IN (
    SELECT a.id, a.auction_discount, g.auction_scheme, g.chit_value 
    FROM auctions a 
    JOIN groups g ON g.id = a.group_id
    WHERE a.group_id = p_group_id AND a.status = 'confirmed'
  ) LOOP
    -- Determine what the "Bid" was based on existing columns
    IF r.auction_scheme = 'DIVIDEND' THEN
      v_bid_to_use := r.chit_value - r.auction_discount;
    ELSE
      v_bid_to_use := r.auction_discount;
    END IF;

    -- Recalculate based on NEWEST group rules
    v_calc := public.calculate_auction(p_group_id, v_bid_to_use);
    
    -- Update the auction's dividend/payout
    UPDATE auctions SET
      dividend   = (v_calc->>'per_member_div')::numeric,
      net_payout = (v_calc->>'net_payout')::numeric,
      auction_discount = (v_calc->>'auction_discount')::numeric
    WHERE id = r.id;

    -- Update the linked commission record
    UPDATE foreman_commissions SET
      commission_amt  = (v_calc->>'commission_amt')::numeric,
      commission_type = (v_calc->>'commission_type')::text,
      paid_to        = (v_calc->>'commission_recipient')::text,
      commission_rate = (v_calc->>'commission_rate')::numeric,
      net_dividend    = (v_calc->>'net_dividend')::numeric,
      per_member_div  = (v_calc->>'per_member_div')::numeric,
      auction_discount = (v_calc->>'auction_discount')::numeric,
      discount       = v_bid_to_use
    WHERE auction_id = r.id;
  END LOOP;

  -- 2. Sync the accumulated_surplus for the group
  UPDATE groups g
  SET accumulated_surplus = (
    SELECT COALESCE(SUM(a.auction_discount - c.commission_amt), 0)
    FROM auctions a
    JOIN foreman_commissions c ON c.auction_id = a.id
    WHERE a.group_id = p_group_id 
      AND a.status = 'confirmed' 
      AND c.status = 'confirmed'
  )
  WHERE id = p_group_id AND g.auction_scheme = 'ACCUMULATION';

  RETURN json_build_object('success', true, 'group_id', p_group_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
