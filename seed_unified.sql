'''
-- ====================================================================
-- Unified Dev Seeding Script for ChitVault
-- 
-- PURPOSE:
-- This script automates the creation of development users and their
-- corresponding profiles, eliminating the manual, error-prone steps
-- that caused login race conditions.
--
-- IT DOES:
-- 1. Creates users in Supabase Auth (`auth.users`).
-- 2. Creates the corresponding identities (`auth.identities`).
-- 3. Creates the application-level profiles (`public.profiles`)
--    and links them to the auth users with the correct UUIDs.
-- 
-- HOW TO USE:
-- 1. Run the main `schema.sql` to ensure your database schema is up to date.
-- 2. Run this script in the Supabase SQL Editor.
--    It is safe to re-run; it will not create duplicate users.
-- ====================================================================

do $$
DECLARE
  -- Declare UUID variables to hold the IDs of the created users
  admin_uuid uuid;
  manager_uuid uuid;
  staff_uuid uuid;
  dev_firm_id int;
BEGIN

  -- === 1. CREATE THE DEVELOPMENT FIRM ===
  -- Upsert the firm to avoid duplicates, and get its ID.
  INSERT INTO public.firms (name)
  VALUES ('Dev Firm')
  ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO dev_firm_id;

  -- === 2. CREATE ADMIN USER AND PROFILE ===
  -- Check if the user already exists before creating
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@dev.chitvault.local') THEN
    -- Insert into auth.users and capture the generated UUID
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_token, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_sent_at, confirmed_at)
    VALUES (current_setting('app.instance_id')::uuid, gen_random_uuid(), 'authenticated', 'authenticated', 'admin@dev.chitvault.local', crypt('DevPass123!', gen_salt('bf')), now(), '', NULL, NULL, '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', NULL, now()) 
    RETURNING id INTO admin_uuid;

    -- Insert the corresponding identity for the user
    INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), admin_uuid, format('{"sub":"%s","email":"admin@dev.chitvault.local"}', admin_uuid)::jsonb, 'email', now(), now(), now());
  ELSE
    -- If user exists, just get their UUID
    SELECT id INTO admin_uuid FROM auth.users WHERE email = 'admin@dev.chitvault.local';
  END IF;

  -- Upsert the profile, linking it to the auth user via the captured UUID
  INSERT INTO public.profiles (id, firm_id, role, name)
  VALUES (admin_uuid, dev_firm_id, 'owner', 'Admin Dev')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, firm_id = EXCLUDED.firm_id;

  -- === 3. CREATE MANAGER USER AND PROFILE ===
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'manager@dev.chitvault.local') THEN
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_token, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_sent_at, confirmed_at)
    VALUES (current_setting('app.instance_id')::uuid, gen_random_uuid(), 'authenticated', 'authenticated', 'manager@dev.chitvault.local', crypt('DevPass123!', gen_salt('bf')), now(), '', NULL, NULL, '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', NULL, now()) 
    RETURNING id INTO manager_uuid;

    INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), manager_uuid, format('{"sub":"%s","email":"manager@dev.chitvault.local"}', manager_uuid)::jsonb, 'email', now(), now(), now());
  ELSE
    SELECT id INTO manager_uuid FROM auth.users WHERE email = 'manager@dev.chitvault.local';
  END IF;

  INSERT INTO public.profiles (id, firm_id, role, name)
  VALUES (manager_uuid, dev_firm_id, 'owner', 'Manager Dev')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, firm_id = EXCLUDED.firm_id;

  -- === 4. CREATE STAFF USER AND PROFILE ===
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'staff@dev.chitvault.local') THEN
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_token, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_sent_at, confirmed_at)
    VALUES (current_setting('app.instance_id')::uuid, gen_random_uuid(), 'authenticated', 'authenticated', 'staff@dev.chitvault.local', crypt('DevPass123!', gen_salt('bf')), now(), '', NULL, NULL, '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', NULL, now()) 
    RETURNING id INTO staff_uuid;

    INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), staff_uuid, format('{"sub":"%s","email":"staff@dev.chitvault.local"}', staff_uuid)::jsonb, 'email', now(), now(), now());
  ELSE
    SELECT id INTO staff_uuid FROM auth.users WHERE email = 'staff@dev.chitvault.local';
  END IF;

  INSERT INTO public.profiles (id, firm_id, role, name)
  VALUES (staff_uuid, dev_firm_id, 'staff', 'Staff Dev')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, firm_id = EXCLUDED.firm_id;

  RAISE NOTICE 'Unified seeding complete! Dev users and profiles are synced.';

END $$;
'''