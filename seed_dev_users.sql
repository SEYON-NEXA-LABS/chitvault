-- ============================================================
-- ChitVault Dev Users Seed Script
-- Inserts test firms, profiles, groups, members for development
-- ============================================================

-- NOTE: This script requires the main schema to be applied first.
-- After running this, you'll need to create auth users manually
-- or use the /register flow to create users via Supabase Auth.

-- ── 0. CLEANUP: DELETE EXISTING SEED DATA ──────────────────

-- Delete in reverse order of dependencies to avoid FK constraint errors
delete from invites where firm_id in ('10000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000001'::uuid);
delete from denominations where firm_id in ('10000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000001'::uuid);
delete from auctions where firm_id in ('10000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000001'::uuid);
delete from payments where firm_id in ('10000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000001'::uuid);
delete from members where firm_id in ('10000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000001'::uuid);
delete from groups where firm_id in ('10000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000001'::uuid);
delete from profiles where firm_id in ('10000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000001'::uuid);
delete from firms where id in ('10000000-0000-0000-0000-000000000001'::uuid, '20000000-0000-0000-0000-000000000001'::uuid);

-- ── 1. BEGIN TRANSACTION WITH DEFERRED CONSTRAINTS ─────────

begin;
set constraints all deferred;

-- ── 2. TEST FIRMS ──────────────────────────────────────────

-- Test Firm 1: Admin Test Company
insert into firms (id, name, slug, owner_id, plan, city, phone)
values (
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Admin Test Company',
  'admin-test',
  null,  -- owner_id will be set when admin user is created
  'trial',
  'Mumbai',
  '+91-9999999999'
)
on conflict do nothing;

-- Test Firm 2: Staff Test Company
insert into firms (id, name, slug, owner_id, plan, city, phone)
values (
  '20000000-0000-0000-0000-000000000001'::uuid,
  'Staff Test Company',
  'staff-test',
  null,
  'trial',
  'Bangalore',
  '+91-8888888888'
)
on conflict do nothing;

-- ── 2. TEST PROFILES (ADMIN & STAFF) ────────────────────────
-- NOTE: You must create the corresponding auth user first!
-- After this script, sign up via /register OR manually create in Supabase Auth Console
-- Once auth user exists with email admin@test.com, uncomment and update the UUID below:

-- insert into profiles (id, firm_id, full_name, role)
-- values (
--   'REPLACE_WITH_ADMIN_UUID'::uuid,
--   '10000000-0000-0000-0000-000000000001'::uuid,
--   'Admin User',
--   'owner'
-- )
-- on conflict (id) do update
-- set firm_id = '10000000-0000-0000-0000-000000000001'::uuid, role = 'owner';

-- Staff User Profile
-- insert into profiles (id, firm_id, full_name, role)
-- values (
--   'REPLACE_WITH_STAFF_UUID'::uuid,
--   '10000000-0000-0000-0000-000000000001'::uuid,
--   'Staff User',
--   'staff'
-- )
-- on conflict (id) do update
-- set firm_id = '10000000-0000-0000-0000-000000000001'::uuid, role = 'staff';

-- ── 3. TEST GROUPS (insert first, then reference by ID) ────

insert into groups (firm_id, name, chit_value, num_members, duration, monthly_contribution, start_date, status)
values
  ('10000000-0000-0000-0000-000000000001'::uuid, 'Test Group A', 100000, 12, 12, 8333.33, '2026-03-01', 'active'),
  ('10000000-0000-0000-0000-000000000001'::uuid, 'Test Group B', 50000, 10, 10, 5000, '2026-02-01', 'active')
on conflict do nothing;

-- ── 4. TEST MEMBERS (reference groups by firm_id + order) ───

-- Members for first group (Test Group A - sorted by id, should be first)
insert into members (firm_id, name, phone, address, group_id, ticket_no, status)
select
  '10000000-0000-0000-0000-000000000001'::uuid,
  m.name, m.phone, m.address, g.id, m.ticket_no, 'active'
from (
  values
    ('Member 1', '9111111111', 'Mumbai', 1),
    ('Member 2', '9222222222', 'Mumbai', 2),
    ('Member 3', '9333333333', 'Mumbai', 3),
    ('Member 4', '9444444444', 'Mumbai', 4),
    ('Member 5', '9555555555', 'Mumbai', 5),
    ('Staff Test Member', '9666666666', 'Mumbai', 6)
) as m(name, phone, address, ticket_no),
lateral (
  select id from groups
  where firm_id = '10000000-0000-0000-0000-000000000001'::uuid
  order by id asc limit 1
) g
on conflict do nothing;

-- Members for second group (Test Group B - sorted by id, should be second)
insert into members (firm_id, name, phone, address, group_id, ticket_no, status)
select
  '10000000-0000-0000-0000-000000000001'::uuid,
  m.name, m.phone, m.address, g.id, m.ticket_no, 'active'
from (
  values
    ('Member 7', '9777777777', 'Pune', 1),
    ('Member 8', '9888888888', 'Pune', 2),
    ('Member 9', '9999999999', 'Pune', 3),
    ('Member 10', '9000000000', 'Pune', 4)
) as m(name, phone, address, ticket_no),
lateral (
  select id from groups
  where firm_id = '10000000-0000-0000-0000-000000000001'::uuid
  order by id asc limit 1 offset 1
) g
on conflict do nothing;

-- ── 5. TEST PAYMENTS & AUCTIONS (using actual group & member IDs) ────

-- Get actual group and member IDs, then insert payments
insert into payments (firm_id, member_id, group_id, month, amount, payment_date, mode, status, payment_type, amount_due)
select
  f.firm_id, m.member_id, g.group_id, 1, p.amount, p.payment_date, p.mode, 'paid', p.payment_type, p.amount_due
from (values
  (1, 8333.33, '2026-03-05'::date, 'Cash', 'full', 0::numeric),
  (2, 8333.33, '2026-03-05'::date, 'Cash', 'full', 0::numeric),
  (3, 8333.33, '2026-03-06'::date, 'Bank Transfer', 'full', 0::numeric),
  (4, 4000, '2026-03-06'::date, 'Cash', 'partial', 4333.33::numeric),
  (5, 8333.33, '2026-03-08'::date, 'UPI', 'full', 0::numeric),
  (7, 5000, '2026-02-05'::date, 'Cash', 'full', 0::numeric),
  (8, 5000, '2026-02-05'::date, 'Cash', 'full', 0::numeric),
  (9, 5000, '2026-02-06'::date, 'Bank Transfer', 'full', 0::numeric)
) as p(ticket_no, amount, payment_date, mode, payment_type, amount_due),
lateral (select '10000000-0000-0000-0000-000000000001'::uuid as firm_id) f,
lateral (
  select m2.id as member_id
  from members m2
  where m2.firm_id = f.firm_id and m2.ticket_no = p.ticket_no
  limit 1
) m,
lateral (
  select g2.id as group_id
  from groups g2
  where g2.firm_id = f.firm_id
  order by g2.id asc
  limit 1 offset (case when p.ticket_no <= 6 then 0 else 1 end)
) g
on conflict do nothing;

-- Insert auctions with actual group and member (winner) IDs
insert into auctions (firm_id, group_id, month, auction_date, winner_id, bid_amount, total_pot, dividend)
select
  f.firm_id, groups_list.group_id, a.month, a.auction_date, 
  (select id from members where firm_id = f.firm_id and ticket_no = a.winner_ticket and group_id = groups_list.group_id limit 1),
  a.bid_amount, a.total_pot, a.dividend
from (values
  (1, 1, '2026-03-08'::date, 15000, 100000, 85000),
  (2, 7, '2026-02-08'::date, 8000, 50000, 42000)
) as a(group_position, winner_ticket, auction_date, bid_amount, total_pot, dividend),
lateral (select '10000000-0000-0000-0000-000000000001'::uuid as firm_id) f,
lateral (
  select id as group_id
  from groups
  where firm_id = f.firm_id
  order by id asc
  limit 1 offset (a.group_position - 1)
) groups_list
on conflict do nothing;

-- ── 6. TEST DENOMINATIONS ──────────────────────────────────

insert into denominations (firm_id, entry_date, note_2000, note_500, note_200, note_100, note_50, note_20, note_10, coin_5, coin_2, coin_1, notes)
values
  ('10000000-0000-0000-0000-000000000001'::uuid, '2026-03-18', 5, 3, 2, 4, 6, 8, 10, 5, 3, 2, 'Test denomination entry'),
  ('10000000-0000-0000-0000-000000000001'::uuid, '2026-03-17', 3, 2, 1, 2, 3, 5, 7, 3, 2, 1, 'Previous day entry')
on conflict do nothing;

-- ── 7. TEST PROFILES (add demo user profiles with placeholder UUIDs) ────────

-- NOTE: These use placeholder UUIDs. After creating auth users manually:
-- 1. Create auth users in Supabase Dashboard (admin@test.com, staff@test.com, etc.)
-- 2. Copy the actual UUIDs from the Users table
-- 3. Update these values with the real UUIDs

-- Placeholder Admin Profile
insert into profiles (id, firm_id, full_name, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Demo Admin User', 'owner')
on conflict (id) do update
set firm_id = '10000000-0000-0000-0000-000000000001'::uuid, role = 'owner', full_name = 'Demo Admin User';

-- Placeholder Staff Profile
insert into profiles (id, firm_id, full_name, role)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '10000000-0000-0000-0000-000000000001'::uuid, 'Demo Staff User', 'staff')
on conflict (id) do update
set firm_id = '10000000-0000-0000-0000-000000000001'::uuid, role = 'staff', full_name = 'Demo Staff User';

-- ── 8. TEST STAFF INVITES ──────────────────────────────────

insert into invites (firm_id, email, role, status, expires_at)
values
  ('10000000-0000-0000-0000-000000000001'::uuid, 'staff@test.com', 'staff', 'pending', now() + interval '7 days'),
  ('10000000-0000-0000-0000-000000000001'::uuid, 'manager@test.com', 'staff', 'pending', now() + interval '7 days')
on conflict do nothing;

-- ── 9. COMMIT TRANSACTION ──────────────────────────────────

commit;

-- ============================================================
-- IMPORTANT: NEXT STEPS FOR TESTING
-- ============================================================
-- 
-- 1. RUN THIS SCRIPT in Supabase SQL Editor ✓ (All tables populated)
--
-- 2. CREATE AUTH USERS MANUALLY (via Supabase Dashboard):
--    - Go to Authentication > Users > Add user
--    - Create: admin@test.com / password: TestPass123!
--    - Create: staff@test.com / password: TestPass123!
--    - Create: manager@test.com / password: TestPass123!
--    
-- 3. UPDATE PROFILE UUIDs:
--    - Copy the UUID of admin@test.com from Users table
--    - Replace 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' with the actual UUID
--    - Copy the UUID of staff@test.com
--    - Replace 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' with the actual UUID
--    - Run the profile UPDATE statements
--    
-- 4. USE DEV TOOLS PANEL (bottom-right corner in dev):
--    - Click "Copy [Role] Credentials" buttons
--    - Paste into login form & sign in
--    - App will automatically redirect to /dashboard
--
-- 5. WHAT'S SEEDED:
--    ✓ Firms (2): Admin Test Company, Staff Test Company
--    ✓ Groups (2): Test Group A (100k, 12mo), Test Group B (50k, 10mo)
--    ✓ Members (10): Across both groups
--    ✓ Payments (8): Sample monthly contributions
--    ✓ Auctions (2): Sample chit auctions
--    ✓ Denominations (2): Sample cash entries
--    ✓ Invites (2): Pending staff invitations
--    ⏳ Profiles (3): Placeholder UUIDs—update with real auth UUIDs
--
-- ============================================================
