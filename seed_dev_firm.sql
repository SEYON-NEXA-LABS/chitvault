-- ============================================================
-- RESET & RESEED FROM AUTH (keeps auth.* users; rebuilds public.*)
-- Target users (by email) expected to already exist in auth.users:
--   admin@dev.chitvault.local    -> owner
--   manager@dev.chitvault.local  -> owner
--   staff@dev.chitvault.local    -> staff
--
-- Safe to re-run (idempotent)
-- ============================================================

-- 0) Extensions we rely on for hashing, etc. (no-op if already there)
create extension if not exists "pgcrypto";

-- 1) Turn off RLS temporarily (optional; you run as superuser in SQL Editor)
--    This avoids policy checks during reset.
do $$ begin
  perform 1;
  begin
    alter table if exists public.firms         disable row level security;
    alter table if exists public.profiles      disable row level security;
    alter table if exists public.groups        disable row level security;
    alter table if exists public.members       disable row level security;
    alter table if exists public.auctions      disable row level security;
    alter table if exists public.payments      disable row level security;
    alter table if exists public.denominations disable row level security;
    alter table if exists public.invites       disable row level security;
  exception when others then null;
  end;
end $$;

-- 2) Wipe app data (public schema only). This does not touch auth.*
--    TRUNCATE with CASCADE clears children in the right order.
do $wipe$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='foreman_commissions')
  then
    execute 'truncate table public.foreman_commissions restart identity cascade';
  end if;

  execute 'truncate table public.denominations restart identity cascade';
  execute 'truncate table public.payments      restart identity cascade';
  execute 'truncate table public.auctions      restart identity cascade';
  execute 'truncate table public.members       restart identity cascade';
  execute 'truncate table public.groups        restart identity cascade';
  execute 'truncate table public.invites       restart identity cascade';
  execute 'truncate table public.profiles      restart identity cascade';
  execute 'truncate table public.firms         restart identity cascade';
end
$wipe$;

-- 3) Read existing Auth users (by email) and build fresh domain data
do $seed$
declare
  -- Source emails that already exist in auth.users
  e_admin   text := 'admin@dev.chitvault.local';
  e_manager text := 'manager@dev.chitvault.local';
  e_staff   text := 'staff@dev.chitvault.local';

  -- User ids from auth.users
  u_admin   uuid;
  u_manager uuid;
  u_staff   uuid;

  -- Firm and groups
  f_dev     uuid;
  g_alpha   bigint;
  g_beta    bigint;

  -- Helpers
  m_amt_alpha numeric;
  m_amt_beta  numeric;

  -- Winner ids for auctions
  w1_alpha bigint;
  w2_alpha bigint;
  w1_beta  bigint;
  w2_beta  bigint;

begin
  -- Assert the users exist in auth.users (raise a helpful error if missing)
  select id into u_admin   from auth.users where email = e_admin;
  select id into u_manager from auth.users where email = e_manager;
  select id into u_staff   from auth.users where email = e_staff;

  if u_admin   is null then raise exception 'Missing auth user: %', e_admin; end if;
  if u_manager is null then raise exception 'Missing auth user: %', e_manager; end if;
  if u_staff   is null then raise exception 'Missing auth user: %', e_staff; end if;

  -- 3.1 Firm
  insert into public.firms (name, slug, owner_id, city, phone)
  values ('Dev ChitVault', 'dev-chitvault', u_admin, 'MTP', '+91-90000-00000')
  on conflict (slug) do update set owner_id = excluded.owner_id, updated_at = now();

  select id into f_dev from public.firms where slug = 'dev-chitvault';

  -- 3.2 Profiles (link existing auth users; 2 owners + 1 staff)
  insert into public.profiles (id, firm_id, full_name, role)
  values
    (u_admin,   f_dev, 'Admin User',   'owner'),
    (u_manager, f_dev, 'Manager User', 'owner'),
    (u_staff,   f_dev, 'Staff User',   'staff')
  on conflict (id) do update
    set firm_id = excluded.firm_id,
        role    = excluded.role,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        updated_at = now();

  -- 3.3 Groups
  insert into public.groups
      (firm_id, name, chit_value, num_members, duration, monthly_contribution, start_date, status, auction_scheme, commission_type, commission_value)
  values
      (f_dev, 'DEV-10x10L', 100000.00, 10, 10, 10000.00, (date_trunc('month', now()))::date, 'active', 'DIVIDEND', 'percent_of_chit', 5.00),
      (f_dev, 'DEV-8x8L',    80000.00,  8,  8, 10000.00, (date_trunc('month', now()) - interval '1 month')::date, 'active', 'DIVIDEND', 'percent_of_chit', 5.00)
  on conflict do nothing;

  select id into g_alpha from public.groups where firm_id=f_dev and name='DEV-10x10L';
  select id into g_beta  from public.groups where firm_id=f_dev and name='DEV-8x8L';

  -- 3.4 Members (10 in alpha, 8 in beta)
  for i in 1..10 loop
    insert into public.members (firm_id, name, phone, address, group_id, ticket_no, status)
    values (f_dev, format('Alpha Member %s', i), format('+91-95%06s', i), 'MTP', g_alpha, i, 'active')
    on conflict do nothing;
  end loop;

  for i in 1..8 loop
    insert into public.members (firm_id, name, phone, address, group_id, ticket_no, status)
    values (f_dev, format('Beta Member %s', i), format('+91-96%06s', i), 'MTP', g_beta,  i, 'active')
    on conflict do nothing;
  end loop;

  -- 3.5 Auctions (months 1 & 2 for both groups)
  select monthly_contribution into m_amt_alpha from public.groups where id=g_alpha;
  select monthly_contribution into m_amt_beta  from public.groups where id=g_beta;

  select id into w1_alpha from public.members where group_id=g_alpha and ticket_no=1;
  select id into w2_alpha from public.members where group_id=g_alpha and ticket_no=2;
  select id into w1_beta  from public.members where group_id=g_beta  and ticket_no=1;
  select id into w2_beta  from public.members where group_id=g_beta  and ticket_no=2;

  insert into public.auctions
    (firm_id, group_id, month, auction_date, winner_id, bid_amount, total_pot, dividend, net_payout)
  values
    (f_dev, g_alpha, 1, (date_trunc('month', now())::date + interval '10 days')::date, w1_alpha, 30000.00, 100000.00, 7000.00, 25000.00),
    (f_dev, g_alpha, 2, (date_trunc('month', now())::date + interval '40 days')::date, w2_alpha, 20000.00, 100000.00, 8000.00, 15000.00),
    (f_dev, g_beta,  1, (date_trunc('month', now())::date + interval '12 days')::date, w1_beta,  25000.00,  80000.00, 6875.00, 21000.00),
    (f_dev, g_beta,  2, (date_trunc('month', now())::date + interval '42 days')::date, w2_beta,  15000.00,  80000.00, 8125.00, 11000.00)
  on conflict (firm_id, group_id, month) do nothing;

  -- 3.6 Payments (month 1)
  -- Full payments for tickets 1,3,4,5 in Alpha collected by staff
  insert into public.payments
    (firm_id, member_id, group_id, month, amount, payment_date, mode, status, payment_type, amount_due, balance_due, collected_by)
  select
    f_dev, m.id, g_alpha, 1, m_amt_alpha, current_date, 'Cash', 'paid', 'full', m_amt_alpha, 0.00, u_staff
  from public.members m
  where m.group_id=g_alpha and m.ticket_no in (1,3,4,5)
  on conflict do nothing;

  -- Partial for ticket 2 (Alpha): 4000 + 6000
  insert into public.payments
    (firm_id, member_id, group_id, month, amount, payment_date, mode, status, payment_type, amount_due, balance_due, collected_by)
  select f_dev, m.id, g_alpha, 1, 4000.00, current_date, 'UPI', 'paid', 'partial', m_amt_alpha, m_amt_alpha-4000.00, u_staff
  from public.members m where m.group_id=g_alpha and m.ticket_no=2
  on conflict do nothing;

  insert into public.payments
    (firm_id, member_id, group_id, month, amount, payment_date, mode, status, payment_type, amount_due, balance_due, collected_by)
  select f_dev, m.id, g_alpha, 1, 6000.00, current_date, 'UPI', 'paid', 'partial', m_amt_alpha, 0.00, u_staff
  from public.members m where m.group_id=g_alpha and m.ticket_no=2
  on conflict do nothing;

  -- 3.7 Denominations (today)
  insert into public.denominations (firm_id, entry_date, collected_by, note_500, note_200, note_100, note_50, note_20, note_10, coin_5, notes)
  values (f_dev, current_date, u_staff, 40, 20, 10, 10, 10, 10, 10, 'Dev day open')
  on conflict do nothing;

  -- 3.8 Invites
  insert into public.invites (firm_id, email, role, invited_by, status, expires_at)
  values (f_dev, 'newhire@dev.chitvault.local', 'staff', u_admin, 'pending', now() + interval '7 days')
  on conflict do nothing;

  -- 3.9 Optional: seed a foreman_commissions row if table exists
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='foreman_commissions') then
    insert into public.foreman_commissions
      (firm_id, group_id, auction_id, month, chit_value, bid_amount, discount,
       commission_type, commission_rate, commission_amt, net_dividend, per_member_div, paid_to, notes, created_by)
    select
      a.firm_id, a.group_id, a.id, a.month,
      100000.00, a.bid_amount, (100000.00 - a.bid_amount),
      'percent_of_chit', 5.00,
      5000.00,
      (100000.00 - a.bid_amount - 5000.00),
      round((100000.00 - a.bid_amount - 5000.00)/10.0, 2),
      'foreman', 'seed demo', u_admin
    from public.auctions a
    where a.group_id = g_alpha and a.month = 1
    on conflict do nothing;
  end if;

end
$seed$;

-- 4) (Optional) Re-enable RLS after reset, if you disabled it above.
do $$ begin
  perform 1;
  begin
    alter table if exists public.firms         enable row level security;
    alter table if exists public.profiles      enable row level security;
    alter table if exists public.groups        enable row level security;
    alter table if exists public.members       enable row level security;
    alter table if exists public.auctions      enable row level security;
    alter table if exists public.payments      enable row level security;
    alter table if exists public.denominations enable row level security;
    alter table if exists public.invites       enable row level security;
  exception when others then null;
  end;
end $$;

-- Quick sanity checks (optional)
-- select * from public.firms;
-- select id, role, firm_id from public.profiles order by role desc;
-- select name, ticket_no from public.members where group_id in (select id from public.groups) order by group_id, ticket_no;
