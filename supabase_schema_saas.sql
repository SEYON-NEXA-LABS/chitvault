-- ============================================================
--  ChitVault SaaS — Multi-Tenant Schema
--  Run this in Supabase SQL Editor
-- ============================================================

-- ── 1. FIRMS ─────────────────────────────────────────────────
create table if not exists firms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                    -- "Kumari Chit Funds"
  slug        text not null unique,             -- "kumari-chits" (subdomain)
  owner_id    uuid references auth.users(id) on delete set null,
  plan        text default 'trial',             -- trial | basic | pro
  plan_status text default 'active',            -- active | suspended | cancelled
  trial_ends  timestamptz default (now() + interval '30 days'),
  invoice_ref text,                             -- your manual invoice number
  city        text,
  phone       text,
  created_at  timestamptz default now()
);

-- ── 2. PROFILES (links auth users to firms + role) ───────────
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  firm_id    uuid references firms(id) on delete cascade,
  full_name  text,
  role       text default 'staff',   -- owner | staff | superadmin
  created_at timestamptz default now()
);

-- Auto-create profile on sign up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
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

-- ── 3. GROUPS ────────────────────────────────────────────────
create table if not exists groups (
  id                   bigint primary key generated always as identity,
  firm_id              uuid not null references firms(id) on delete cascade,
  name                 text not null,
  chit_value           numeric not null,
  num_members          int not null,
  duration             int not null,
  monthly_contribution numeric not null,
  start_date           date,
  status               text default 'active',
  created_at           timestamptz default now()
);

-- ── 4. MEMBERS ───────────────────────────────────────────────
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
  created_at       timestamptz default now()
);

-- ── 5. AUCTIONS ──────────────────────────────────────────────
create table if not exists auctions (
  id           bigint primary key generated always as identity,
  firm_id      uuid not null references firms(id) on delete cascade,
  group_id     bigint references groups(id) on delete cascade,
  month        int not null,
  auction_date date,
  winner_id    bigint references members(id) on delete set null,
  bid_amount   numeric not null,
  total_pot    numeric not null,
  dividend     numeric not null,
  created_at   timestamptz default now(),
  unique(firm_id, group_id, month)
);

-- ── 6. PAYMENTS ──────────────────────────────────────────────
create table if not exists payments (
  id           bigint primary key generated always as identity,
  firm_id      uuid not null references firms(id) on delete cascade,
  member_id    bigint references members(id) on delete cascade,
  group_id     bigint references groups(id) on delete cascade,
  month        int not null,
  amount       numeric not null,
  payment_date date,
  mode         text default 'Cash',
  status       text default 'paid',
  created_at   timestamptz default now(),
  unique(firm_id, member_id, group_id, month)
);

-- ── INDEXES (performance) ─────────────────────────────────────
create index if not exists idx_groups_firm    on groups(firm_id);
create index if not exists idx_members_firm   on members(firm_id);
create index if not exists idx_auctions_firm  on auctions(firm_id);
create index if not exists idx_payments_firm  on payments(firm_id);
create index if not exists idx_profiles_firm  on profiles(firm_id);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
alter table firms    enable row level security;
alter table profiles enable row level security;
alter table groups   enable row level security;
alter table members  enable row level security;
alter table auctions enable row level security;
alter table payments enable row level security;

-- Helper: get current user's firm_id
create or replace function my_firm_id()
returns uuid language sql stable as $$
  select firm_id from profiles where id = auth.uid()
$$;

-- Helper: is current user a superadmin?
create or replace function is_superadmin()
returns boolean language sql stable as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'superadmin'
  )
$$;

-- Drop old policies
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies
    where tablename in ('firms','profiles','groups','members','auctions','payments')
  loop
    execute 'drop policy if exists "' || r.policyname || '" on ' || r.tablename;
  end loop;
end $$;

-- FIRMS: owner or superadmin
create policy "firms_select" on firms for select
  using (owner_id = auth.uid() or is_superadmin());
create policy "firms_insert" on firms for insert
  with check (owner_id = auth.uid() or is_superadmin());
create policy "firms_update" on firms for update
  using (owner_id = auth.uid() or is_superadmin());

-- PROFILES: own profile or same firm or superadmin
create policy "profiles_select" on profiles for select
  using (id = auth.uid() or firm_id = my_firm_id() or is_superadmin());
create policy "profiles_insert" on profiles for insert
  with check (id = auth.uid() or is_superadmin());
create policy "profiles_update" on profiles for update
  using (id = auth.uid() or is_superadmin());

-- DATA TABLES: firm-scoped
create policy "groups_all"   on groups   for all using (firm_id = my_firm_id() or is_superadmin()) with check (firm_id = my_firm_id() or is_superadmin());
create policy "members_all"  on members  for all using (firm_id = my_firm_id() or is_superadmin()) with check (firm_id = my_firm_id() or is_superadmin());
create policy "auctions_all" on auctions for all using (firm_id = my_firm_id() or is_superadmin()) with check (firm_id = my_firm_id() or is_superadmin());
create policy "payments_all" on payments for all using (firm_id = my_firm_id() or is_superadmin()) with check (firm_id = my_firm_id() or is_superadmin());

-- GRANTS
grant all on firms, profiles, groups, members, auctions, payments to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ── SUPERADMIN SETUP ─────────────────────────────────────────
-- After running this schema, sign up at your app then run:
--   update profiles set role = 'superadmin' where id = '<your-user-id>';

-- ── STAFF INVITES TABLE ───────────────────────────────────────
create table if not exists invites (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references firms(id) on delete cascade,
  email       text not null,
  role        text default 'staff',        -- staff | owner
  invited_by  uuid references auth.users(id),
  status      text default 'pending',      -- pending | accepted | expired
  created_at  timestamptz default now(),
  expires_at  timestamptz default (now() + interval '7 days'),
  unique(firm_id, email)
);

alter table invites enable row level security;
grant all on invites to authenticated;

-- Owner can manage invites for their firm
create policy "invites_select" on invites for select
  using (firm_id = my_firm_id() or is_superadmin());
create policy "invites_insert" on invites for insert
  with check (firm_id = my_firm_id());
create policy "invites_update" on invites for update
  using (firm_id = my_firm_id() or id in (
    select id from invites where email = (select email from auth.users where id = auth.uid())
  ));
create policy "invites_delete" on invites for delete
  using (firm_id = my_firm_id() or is_superadmin());

-- Allow reading invite by id even before login (for accept flow)
create policy "invites_public_read" on invites for select
  using (true);

-- ── GRANULAR RLS FOR STAFF ROLE ───────────────────────────────
-- Helper: is current user an owner of their firm?
create or replace function is_firm_owner()
returns boolean language sql stable as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and firm_id = my_firm_id()
    and role in ('owner', 'superadmin')
  )
$$;

-- Drop and recreate data policies with owner-write, staff-read
drop policy if exists "groups_all"   on groups;
drop policy if exists "members_all"  on members;
drop policy if exists "auctions_all" on auctions;
drop policy if exists "payments_all" on payments;

-- GROUPS: owner can write, staff can only read
create policy "groups_select" on groups for select
  using (firm_id = my_firm_id() or is_superadmin());
create policy "groups_insert" on groups for insert
  with check ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());
create policy "groups_update" on groups for update
  using ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());
create policy "groups_delete" on groups for delete
  using ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());

-- MEMBERS: owner can write, staff can only read
create policy "members_select" on members for select
  using (firm_id = my_firm_id() or is_superadmin());
create policy "members_insert" on members for insert
  with check ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());
create policy "members_update" on members for update
  using ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());
create policy "members_delete" on members for delete
  using ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());

-- AUCTIONS: owner can write, staff can only read
create policy "auctions_select" on auctions for select
  using (firm_id = my_firm_id() or is_superadmin());
create policy "auctions_insert" on auctions for insert
  with check ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());
create policy "auctions_update" on auctions for update
  using ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());
create policy "auctions_delete" on auctions for delete
  using ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());

-- PAYMENTS: both owner and staff can record payments
create policy "payments_select" on payments for select
  using (firm_id = my_firm_id() or is_superadmin());
create policy "payments_insert" on payments for insert
  with check (firm_id = my_firm_id() or is_superadmin());
create policy "payments_update" on payments for update
  using ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());
create policy "payments_delete" on payments for delete
  using ((firm_id = my_firm_id() and is_firm_owner()) or is_superadmin());

-- ── PAYMENTS TABLE — allow partial payments ───────────────────
-- Drop old unique constraint, add new columns
alter table payments
  add column if not exists payment_type  text default 'full',   -- full | partial
  add column if not exists amount_due    numeric default 0,      -- full amount expected for this month
  add column if not exists balance_due   numeric default 0,      -- remaining after this payment
  add column if not exists collected_by  uuid references auth.users(id) on delete set null;

-- Remove the old unique constraint so multiple partial payments per month are allowed
alter table payments
  drop constraint if exists payments_firm_id_member_id_group_id_month_key,
  drop constraint if exists payments_member_id_group_id_month_key;

-- New index: still want fast lookup per member+month
create index if not exists idx_payments_member_month
  on payments(firm_id, member_id, group_id, month);

-- ── DAILY DENOMINATION TABLE ──────────────────────────────────
create table if not exists denominations (
  id           bigint primary key generated always as identity,
  firm_id      uuid not null references firms(id) on delete cascade,
  entry_date   date not null default current_date,
  collected_by uuid references auth.users(id) on delete set null,
  -- Note denominations
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
  -- Computed total (stored for fast query)
  total        numeric generated always as (
    note_2000*2000 + note_500*500 + note_200*200 + note_100*100 +
    note_50*50 + note_20*20 + note_10*10 +
    coin_5*5 + coin_2*2 + coin_1*1
  ) stored,
  notes        text,
  created_at   timestamptz default now()
);

create index if not exists idx_denominations_firm_date
  on denominations(firm_id, entry_date desc);

alter table denominations enable row level security;
grant all on denominations to authenticated;
grant usage, select on sequence denominations_id_seq to authenticated;

-- Both owner and staff can create denomination entries
create policy "denom_select" on denominations for select
  using (firm_id = my_firm_id() or is_superadmin());
create policy "denom_insert" on denominations for insert
  with check (firm_id = my_firm_id());
create policy "denom_update" on denominations for update
  using (firm_id = my_firm_id() and (collected_by = auth.uid() or is_firm_owner()));
create policy "denom_delete" on denominations for delete
  using (firm_id = my_firm_id() and is_firm_owner());
