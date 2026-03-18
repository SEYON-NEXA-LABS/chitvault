-- ============================================================
-- ChitVault SaaS — Multi-Tenant Schema (v1.2)
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
  phone       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

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

-- 1.2 PROFILES
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  firm_id    uuid references firms(id) on delete cascade,
  full_name  text,
  role       text default 'staff',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_chk') then
    alter table profiles add constraint profiles_role_chk
      check (role in ('owner','staff','superadmin'));
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
  start_date           date,
  status               text default 'active',
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),
  constraint groups_status_chk check (status in ('active','paused','closed')),
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
  bid_amount   numeric(12,2) not null,
  total_pot    numeric(12,2) not null,
  dividend     numeric(12,2) not null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique(firm_id, group_id, month),
  constraint auctions_amounts_nonneg_chk check (bid_amount >= 0 and total_pot >= 0 and dividend >= 0)
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
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  constraint payments_amounts_nonneg_chk
    check (amount >= 0 and amount_due >= 0 and balance_due >= 0)
);

-- Remove old unique constraint to allow multiple partial payments per month
alter table payments
  drop constraint if exists payments_firm_id_member_id_group_id_month_key,
  drop constraint if exists payments_member_id_group_id_month_key;

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
  updated_at   timestamptz default now()
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
returns uuid language sql stable set search_path = public as $$
  select firm_id from profiles where id = auth.uid() order by created_at desc limit 1
$$;

create or replace function is_superadmin()
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'superadmin')
$$;

create or replace function is_firm_owner()
returns boolean language sql stable set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and firm_id = my_firm_id() and role in ('owner','superadmin')
  )
$$;

-- Drop all existing policies
do $pol$ declare r record; begin
  for r in select schemaname, tablename, policyname from pg_policies
    where tablename in ('firms','profiles','groups','members','auctions','payments','invites','denominations')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $pol$;

-- FIRMS
create policy firms_select on firms for select
  using (owner_id = auth.uid() or is_superadmin());
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
grant all on firms, profiles, groups, members, auctions, payments, invites, denominations to authenticated;

-- ── 4. AUTH TRIGGER: AUTO-CREATE PROFILE ON SIGNUP ───────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
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
  if auth.uid() is null then
    raise exception 'Must be authenticated to register a firm';
  end if;

  -- Check slug available
  if exists (select 1 from firms where slug = p_slug) then
    raise exception 'SLUG_TAKEN';
  end if;

  -- Create firm
  insert into firms (name, slug, owner_id, city, phone, plan)
  values (p_name, p_slug, auth.uid(), p_city, p_phone, 'trial')
  returning id into v_firm_id;

  -- Link profile: set firm_id + role + optionally name
  update profiles
     set firm_id   = v_firm_id,
         role      = 'owner',
         full_name = coalesce(p_full_name, full_name)
   where id = auth.uid();

  return v_firm_id;
end;
$$;

grant execute on function public.register_firm(text,text,text,text,text) to authenticated;

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
begin
  if auth.uid() is null then
    raise exception 'Must be authenticated';
  end if;

  select firm_id, role, expires_at, status, email
  into v_firm, v_role, v_expires, v_status, v_email
  from invites where id = invite_id;

  if not found then raise exception 'Invite not found'; end if;
  if v_status <> 'pending' then raise exception 'Invite already used or expired'; end if;
  if now() > v_expires then raise exception 'Invite link has expired'; end if;

  -- Verify the logged-in user's email matches the invite email
  select email into v_user_email from auth.users where id = auth.uid();
  if lower(v_user_email) <> lower(v_email) then
    raise exception 'This invite was sent to a different email address';
  end if;

  update profiles
     set firm_id = v_firm, role = coalesce(v_role, 'staff')
   where id = auth.uid();

  update invites set status = 'accepted' where id = invite_id;
end;
$$;

grant execute on function public.accept_invite(uuid) to authenticated;

-- ── 7. RPC: GET INVITE (public read for invite page) ─────────
create or replace function public.get_invite(invite_id uuid)
returns table (
  id uuid, firm_id uuid, email text, role text,
  status text, expires_at timestamptz, firm_name text
)
language sql stable security definer set search_path = public as $$
  select i.id, i.firm_id, i.email, i.role, i.status, i.expires_at, f.name as firm_name
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
create or replace view v_member_dues as
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
