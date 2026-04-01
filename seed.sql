-- ====================================================================
-- ChitVault Targeted Demo Seeding Script (Non-Destructive & Fixed ID)
-- 
-- PURPOSE:
-- 1. Syncs development auth users (admin, manager, staff).
-- 2. Creates/Updates "Demo Corp" with a STATIC UUID.
-- 3. Targets and REPLACES data ONLY for "Demo Corp" (idempotent).
-- 4. Seeds 3 months of history for realistic report testing.
--
-- TARGET USERS:
-- admin@dev.chitvault.local    / DevPass123! (Owner)  UUID: ba8a81ff-67cc-4d3b-bced-d96bbc88834c
-- manager@dev.chitvault.local  / DevPass123! (Owner)  UUID: 088857a0-cd2d-4bec-986b-047951357aef
-- staff@dev.chitvault.local    / DevPass123! (Staff)  UUID: b7568d38-f817-4aea-a394-d7e66b1cff83
-- ====================================================================

-- ── 1. AUTH SYNC: Create/Sync dev users in auth.* ──────────────────────
do $auth_sync$
DECLARE
  admin_uuid uuid := 'ba8a81ff-67cc-4d3b-bced-d96bbc88834c'::uuid;
  manager_uuid uuid := '088857a0-cd2d-4bec-986b-047951357aef'::uuid;
  staff_uuid uuid := 'b7568d38-f817-4aea-a394-d7e66b1cff83'::uuid;
BEGIN
  -- Admin
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@dev.chitvault.local') THEN
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid, admin_uuid, 'authenticated', 'authenticated', 'admin@dev.chitvault.local', crypt('DevPass123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
    
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), admin_uuid, format('{"sub":"%s","email":"admin@dev.chitvault.local"}', admin_uuid)::jsonb, 'email', admin_uuid, now(), now(), now());
  END IF;

  -- Manager
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'manager@dev.chitvault.local') THEN
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid, manager_uuid, 'authenticated', 'authenticated', 'manager@dev.chitvault.local', crypt('DevPass123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
    
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), manager_uuid, format('{"sub":"%s","email":"manager@dev.chitvault.local"}', manager_uuid)::jsonb, 'email', manager_uuid, now(), now(), now());
  END IF;

  -- Staff
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'staff@dev.chitvault.local') THEN
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES ('00000000-0000-0000-0000-000000000000'::uuid, staff_uuid, 'authenticated', 'authenticated', 'staff@dev.chitvault.local', crypt('DevPass123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
    
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), staff_uuid, format('{"sub":"%s","email":"staff@dev.chitvault.local"}', staff_uuid)::jsonb, 'email', staff_uuid, now(), now(), now());
  END IF;
END
$auth_sync$;

-- ── 2. FIRM & TARGETED CLEANUP: Setup/Reset Demo Corp ───────────────────
do $demo_seed$
DECLARE
  v_demo_firm_id uuid := 'd0000000-0000-0000-0000-000000000001'::uuid;
  admin_uuid uuid;
  manager_uuid uuid;
  staff_uuid uuid;
  g_div_id bigint;
  g_acc_id bigint;
  v_auc_id bigint;
  p_ids bigint[];
  p_id bigint;
  i int;
BEGIN
  -- Get user IDs
  SELECT id INTO admin_uuid FROM auth.users WHERE email = 'admin@dev.chitvault.local';
  SELECT id INTO manager_uuid FROM auth.users WHERE email = 'manager@dev.chitvault.local';
  SELECT id INTO staff_uuid FROM auth.users WHERE email = 'staff@dev.chitvault.local';

  -- Upsert Firm: "Demo Corp" with FIXED UUID
  INSERT INTO public.firms (id, name, slug, owner_id, city, phone, theme_id)
  VALUES (v_demo_firm_id, 'Demo Corp', 'demo-corp', admin_uuid, 'Madurai', '+91-98765-43210', 'theme2')
  ON CONFLICT (id) DO UPDATE 
  SET name = EXCLUDED.name, slug = EXCLUDED.slug, owner_id = EXCLUDED.owner_id, city = EXCLUDED.city, phone = EXCLUDED.phone, theme_id = EXCLUDED.theme_id;

  -- TARGETED CLEANUP: Delete only data for this firm (idempotency)
  -- Order: children first, then parents within the firm context
  DELETE FROM public.activity_logs      WHERE firm_id = v_demo_firm_id;
  DELETE FROM public.denominations      WHERE firm_id = v_demo_firm_id;
  DELETE FROM public.foreman_commissions WHERE firm_id = v_demo_firm_id;
  DELETE FROM public.payments          WHERE firm_id = v_demo_firm_id;
  DELETE FROM public.auctions          WHERE firm_id = v_demo_firm_id;
  DELETE FROM public.members           WHERE firm_id = v_demo_firm_id;
  DELETE FROM public.persons           WHERE firm_id = v_demo_firm_id;
  DELETE FROM public.groups            WHERE firm_id = v_demo_firm_id;
  DELETE FROM public.invites           WHERE firm_id = v_demo_firm_id;

  -- Sync profiles
  INSERT INTO public.profiles (id, firm_id, full_name, role)
  VALUES 
    (admin_uuid,   v_demo_firm_id, 'Admin Demo',   'owner'),
    (manager_uuid, v_demo_firm_id, 'Manager Demo', 'owner'),
    (staff_uuid,   v_demo_firm_id, 'Staff Demo',   'staff')
  ON CONFLICT (id) DO UPDATE 
  SET firm_id = EXCLUDED.firm_id, full_name = EXCLUDED.full_name, role = EXCLUDED.role;

  -- ── 3. GROUPS: Initialize Both Auction Models ─────────────────────────
  -- Group 1: DIVIDEND Model (1 Lakh, 10 Months)
  INSERT INTO public.groups (firm_id, name, chit_value, num_members, duration, monthly_contribution, start_date, status, auction_scheme, commission_type, commission_value)
  VALUES (v_demo_firm_id, 'DIV-10x10K', 100000.00, 10, 10, 10000.00, (date_trunc('month', now()) - interval '3 months')::date, 'active', 'DIVIDEND', 'percent_of_chit', 5.00)
  RETURNING id INTO g_div_id;

  -- Group 2: ACCUMULATION Model (50K, 10 Months)
  INSERT INTO public.groups (firm_id, name, chit_value, num_members, duration, monthly_contribution, start_date, status, auction_scheme, commission_type, commission_value)
  VALUES (v_demo_firm_id, 'ACC-10x5K', 50000.00, 10, 10, 5000.00, (date_trunc('month', now()) - interval '3 months')::date, 'active', 'ACCUMULATION', 'percent_of_chit', 5.00)
  RETURNING id INTO g_acc_id;

  -- ── 4. PERSONS & MEMBERS: Create/Enroll 10 unified individuals ───────
  FOR i IN 1..10 LOOP
    INSERT INTO public.persons (firm_id, name, phone, address)
    VALUES (v_demo_firm_id, format('Member %s', i), format('+91-900%02s-0000', i), format('Lane %s, Madurai', i))
    RETURNING id INTO p_id;
    
    INSERT INTO public.members (firm_id, person_id, group_id, ticket_no, status)
    VALUES (v_demo_firm_id, p_id, g_div_id, i, 'active');
    
    INSERT INTO public.members (firm_id, person_id, group_id, ticket_no, status)
    VALUES (v_demo_firm_id, p_id, g_acc_id, i, 'active');
  END LOOP;

  -- ── 5. AUCTIONS: Seed 3 Months History ───────────────────────────
  -- MONTH 1: 
  -- DIV Group Auction 1: Ticket 1 Wins
  INSERT INTO public.auctions (firm_id, group_id, month, auction_date, winner_id, bid_amount, total_pot, dividend, net_payout, is_payout_settled, payout_date, payout_amount)
  VALUES (v_demo_firm_id, g_div_id, 1, (date_trunc('month', now()) - interval '3 months' + interval '10 days')::date, 
    (SELECT id FROM members WHERE group_id = g_div_id AND ticket_no = 1), 15000.00, 100000.00, 8000.00, 10000.00, true, (date_trunc('month', now()) - interval '3 months' + interval '15 days')::date, 10000.00)
  RETURNING id INTO v_auc_id;
  INSERT INTO public.foreman_commissions (firm_id, group_id, auction_id, month, chit_value, bid_amount, discount, commission_type, commission_rate, commission_amt, net_dividend, per_member_div, notes)
  VALUES (v_demo_firm_id, g_div_id, v_auc_id, 1, 100000.00, 15000.00, 85000.00, 'percent_of_chit', 5.00, 5000.00, 80000.00, 8000.00, 'Seed Month 1');
    
  -- ACC Group Auction 1: Ticket 1 Wins
  INSERT INTO public.auctions (firm_id, group_id, month, auction_date, winner_id, bid_amount, total_pot, dividend, net_payout, is_payout_settled, payout_date, payout_amount)
  VALUES (v_demo_firm_id, g_acc_id, 1, (date_trunc('month', now()) - interval '3 months' + interval '12 days')::date, 
    (SELECT id FROM members WHERE group_id = g_acc_id AND ticket_no = 1), 5000.00, 50000.00, 0.00, 42500.00, true, (date_trunc('month', now()) - interval '3 months' + interval '16 days')::date, 42500.00)
  RETURNING id INTO v_auc_id;
  INSERT INTO public.foreman_commissions (firm_id, group_id, auction_id, month, chit_value, bid_amount, discount, commission_type, commission_rate, commission_amt, net_dividend, per_member_div, notes)
  VALUES (v_demo_firm_id, g_acc_id, v_auc_id, 1, 50000.00, 5000.00, 5000.00, 'percent_of_chit', 5.00, 2500.00, 2500.00, 0.00, 'Seed Month 1');
  UPDATE public.groups SET accumulated_surplus = accumulated_surplus + 5000 WHERE id = g_acc_id;

  -- MONTH 2:
  -- DIV Group Auction 2: Ticket 2 Wins
  INSERT INTO public.auctions (firm_id, group_id, month, auction_date, winner_id, bid_amount, total_pot, dividend, net_payout)
  VALUES (v_demo_firm_id, g_div_id, 2, (date_trunc('month', now()) - interval '2 months' + interval '10 days')::date, 
    (SELECT id FROM members WHERE group_id = g_div_id AND ticket_no = 2), 20000.00, 100000.00, 7500.00, 15000.00)
  RETURNING id INTO v_auc_id;
  INSERT INTO public.foreman_commissions (firm_id, group_id, auction_id, month, chit_value, bid_amount, discount, commission_type, commission_rate, commission_amt, net_dividend, per_member_div, notes)
  VALUES (v_demo_firm_id, g_div_id, v_auc_id, 2, 100000.00, 20000.00, 80000.00, 'percent_of_chit', 5.00, 5000.00, 75000.00, 7500.00, 'Seed Month 2');
    
  -- ACC Group Auction 2: Ticket 2 Wins
  INSERT INTO public.auctions (firm_id, group_id, month, auction_date, winner_id, bid_amount, total_pot, dividend, net_payout)
  VALUES (v_demo_firm_id, g_acc_id, 2, (date_trunc('month', now()) - interval '2 months' + interval '12 days')::date, 
    (SELECT id FROM members WHERE group_id = g_acc_id AND ticket_no = 2), 4000.00, 50000.00, 0.00, 43500.00)
  RETURNING id INTO v_auc_id;
  INSERT INTO public.foreman_commissions (firm_id, group_id, auction_id, month, chit_value, bid_amount, discount, commission_type, commission_rate, commission_amt, net_dividend, per_member_div, notes)
  VALUES (v_demo_firm_id, g_acc_id, v_auc_id, 2, 50000.00, 4000.00, 4000.00, 'percent_of_chit', 5.00, 2500.00, 1500.00, 0.00, 'Seed Month 2');
  UPDATE public.groups SET accumulated_surplus = accumulated_surplus + 4000 WHERE id = g_acc_id;

  -- MONTH 3:
  -- DIV Group Auction 3: Ticket 3 Wins
  INSERT INTO public.auctions (firm_id, group_id, month, auction_date, winner_id, bid_amount, total_pot, dividend, net_payout)
  VALUES (v_demo_firm_id, g_div_id, 3, (date_trunc('month', now()) - interval '1 month' + interval '10 days')::date, 
    (SELECT id FROM members WHERE group_id = g_div_id AND ticket_no = 3), 25000.00, 100000.00, 7000.00, 20000.00)
  RETURNING id INTO v_auc_id;
  INSERT INTO public.foreman_commissions (firm_id, group_id, auction_id, month, chit_value, bid_amount, discount, commission_type, commission_rate, commission_amt, net_dividend, per_member_div, notes)
  VALUES (v_demo_firm_id, g_div_id, v_auc_id, 3, 100000.00, 25000.00, 75000.00, 'percent_of_chit', 5.00, 5000.00, 70000.00, 7000.00, 'Seed Month 3');
    
  -- ACC Group Auction 3: Ticket 3 Wins
  INSERT INTO public.auctions (firm_id, group_id, month, auction_date, winner_id, bid_amount, total_pot, dividend, net_payout)
  VALUES (v_demo_firm_id, g_acc_id, 3, (date_trunc('month', now()) - interval '1 month' + interval '12 days')::date, 
    (SELECT id FROM members WHERE group_id = g_acc_id AND ticket_no = 3), 6000.00, 50000.00, 0.00, 41500.00)
  RETURNING id INTO v_auc_id;
  INSERT INTO public.foreman_commissions (firm_id, group_id, auction_id, month, chit_value, bid_amount, discount, commission_type, commission_rate, commission_amt, net_dividend, per_member_div, notes)
  VALUES (v_demo_firm_id, g_acc_id, v_auc_id, 3, 50000.00, 6000.00, 6000.00, 'percent_of_chit', 5.00, 2500.00, 3500.00, 0.00, 'Seed Month 3');
  UPDATE public.groups SET accumulated_surplus = accumulated_surplus + 6000 WHERE id = g_acc_id;

  -- ── 6. PAYMENTS: Seed Realistic Collections ────────────────────────
  -- Month 1 (All Paid)
  INSERT INTO public.payments (firm_id, member_id, group_id, month, amount, payment_date, mode, status, payment_type, amount_due, balance_due, collected_by)
  SELECT v_demo_firm_id, m.id, m.group_id, 1, grp.monthly_contribution, (grp.start_date + interval '5 days')::date, 'Cash', 'paid', 'full', grp.monthly_contribution, 0.00, staff_uuid
  FROM public.members m JOIN public.groups grp ON m.group_id = grp.id WHERE m.firm_id = v_demo_firm_id;

  -- Month 2 (Some Partial, Some Late)
  INSERT INTO public.payments (firm_id, member_id, group_id, month, amount, payment_date, mode, status, payment_type, amount_due, balance_due, collected_by)
  SELECT v_demo_firm_id, m.id, m.group_id, 2, grp.monthly_contribution, (grp.start_date + interval '1 month' + interval '5 days')::date, 'UPI', 'paid', 'full', grp.monthly_contribution, 0.00, staff_uuid
  FROM public.members m JOIN public.groups grp ON m.group_id = grp.id WHERE m.firm_id = v_demo_firm_id AND m.ticket_no <= 5;
  
  INSERT INTO public.payments (firm_id, member_id, group_id, month, amount, payment_date, mode, status, payment_type, amount_due, balance_due, collected_by)
  SELECT v_demo_firm_id, m.id, m.group_id, 2, grp.monthly_contribution / 2, (grp.start_date + interval '1 month' + interval '6 days')::date, 'Cash', 'paid', 'partial', grp.monthly_contribution, grp.monthly_contribution / 2, staff_uuid
  FROM public.members m JOIN public.groups grp ON m.group_id = grp.id WHERE m.firm_id = v_demo_firm_id AND m.ticket_no = 6;

  -- Month 3 (Early entries)
  INSERT INTO public.payments (firm_id, member_id, group_id, month, amount, payment_date, mode, status, payment_type, amount_due, balance_due, collected_by)
  SELECT v_demo_firm_id, m.id, m.group_id, 3, grp.monthly_contribution, (grp.start_date + interval '2 months' + interval '5 days')::date, 'Bank Transfer', 'paid', 'full', grp.monthly_contribution, 0.00, staff_uuid
  FROM public.members m JOIN public.groups grp ON m.group_id = grp.id WHERE m.firm_id = v_demo_firm_id AND m.ticket_no <= 3;

  -- ── 7. DENOMINATIONS & LOGS ─────────────────────────────────────
  INSERT INTO public.denominations (firm_id, entry_date, collected_by, note_500, note_200, note_100, note_50, notes)
  VALUES 
    (v_demo_firm_id, (date_trunc('month', now()) - interval '3 months' + interval '5 days')::date, staff_uuid, 150, 50, 100, 100, 'Month 1 Daily Reconciliation'),
    (v_demo_firm_id, (date_trunc('month', now()) - interval '2 months' + interval '5 days')::date, staff_uuid, 50, 20, 10, 5, 'Month 2 Cash Collection');

  INSERT INTO public.activity_logs (firm_id, user_id, action, entity_type, entity_id, metadata)
  VALUES 
    (v_demo_firm_id, admin_uuid, 'FIRM_CREATED', 'firms', v_demo_firm_id::text, '{"name": "Demo Corp"}'),
    (v_demo_firm_id, admin_uuid, 'GROUP_CREATED', 'groups', g_div_id::text, '{"name": "DIV-10x10K"}');

  RAISE NOTICE 'Demo seeding with FIXED ID COMPLETE! 🚀 Firm "Demo Corp" (d0000000-0000-0000-0000-000000000001) is ready.';

END
$demo_seed$;
